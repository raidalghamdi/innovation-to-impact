-- Migration 00022: Teams & Group Registration
-- Adds teams, team_members, team_invitations, ip_signatures + ideas.team_id
-- Purpose: Support group/team-based hackathon participation with per-member IP sign-off.

SET search_path = innovation, public;

-- ============================================================
-- 1) teams: a registered team owns exactly one idea (M11)
-- ============================================================
CREATE TABLE IF NOT EXISTS innovation.teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     text NOT NULL,
  name_en     text,
  slug        text UNIQUE,
  leader_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON innovation.teams(leader_id);

-- ============================================================
-- 2) team_members
-- ============================================================
CREATE TABLE IF NOT EXISTS innovation.team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES innovation.teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON innovation.team_members(user_id);

-- Trigger: auto-add leader as first member
CREATE OR REPLACE FUNCTION innovation.fn_add_leader_to_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = innovation, public
AS $$
BEGIN
  INSERT INTO innovation.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.leader_id, 'leader')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_leader_to_members ON innovation.teams;
CREATE TRIGGER trg_add_leader_to_members
AFTER INSERT ON innovation.teams
FOR EACH ROW EXECUTE FUNCTION innovation.fn_add_leader_to_members();

-- ============================================================
-- 3) team_invitations (email-based, tokenized, 14d expiry)
-- ============================================================
CREATE TABLE IF NOT EXISTS innovation.team_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES innovation.teams(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by    uuid NOT NULL REFERENCES auth.users(id),
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','declined','expired','revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team    ON innovation.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email   ON innovation.team_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status  ON innovation.team_invitations(status);

-- ============================================================
-- 4) ip_signatures — each member signs IP terms individually
-- ============================================================
CREATE TABLE IF NOT EXISTS innovation.ip_signatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id         uuid NOT NULL REFERENCES innovation.ideas(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_terms_version text NOT NULL DEFAULT 'v1',
  signed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ip_signatures_idea ON innovation.ip_signatures(idea_id);

-- ============================================================
-- 5) ideas.team_id — link idea to team
-- ============================================================
ALTER TABLE innovation.ideas
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES innovation.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ideas_team ON innovation.ideas(team_id);

-- ============================================================
-- 6) RLS
-- ============================================================
ALTER TABLE innovation.teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation.team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation.team_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation.ip_signatures     ENABLE ROW LEVEL SECURITY;

-- teams: members can read their teams; leader can update/delete; anyone auth can create
DROP POLICY IF EXISTS teams_select ON innovation.teams;
CREATE POLICY teams_select ON innovation.teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM innovation.team_members WHERE user_id = auth.uid())
    OR leader_id = auth.uid()
  );

DROP POLICY IF EXISTS teams_insert ON innovation.teams;
CREATE POLICY teams_insert ON innovation.teams FOR INSERT
  WITH CHECK (leader_id = auth.uid());

DROP POLICY IF EXISTS teams_update ON innovation.teams;
CREATE POLICY teams_update ON innovation.teams FOR UPDATE
  USING (leader_id = auth.uid());

DROP POLICY IF EXISTS teams_delete ON innovation.teams;
CREATE POLICY teams_delete ON innovation.teams FOR DELETE
  USING (leader_id = auth.uid());

-- team_members: members can read their team roster; only leader can add/remove
DROP POLICY IF EXISTS team_members_select ON innovation.team_members;
CREATE POLICY team_members_select ON innovation.team_members FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM innovation.team_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS team_members_insert ON innovation.team_members;
CREATE POLICY team_members_insert ON innovation.team_members FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM innovation.teams WHERE leader_id = auth.uid())
    OR user_id = auth.uid()  -- allow self-join via invite acceptance
  );

DROP POLICY IF EXISTS team_members_delete ON innovation.team_members;
CREATE POLICY team_members_delete ON innovation.team_members FOR DELETE
  USING (
    team_id IN (SELECT id FROM innovation.teams WHERE leader_id = auth.uid())
    OR user_id = auth.uid()  -- self-leave
  );

-- team_invitations: invitee (by email match) or team-leader can read;
-- only leader can create/revoke; invitee can accept/decline
DROP POLICY IF EXISTS team_invitations_select ON innovation.team_invitations;
CREATE POLICY team_invitations_select ON innovation.team_invitations FOR SELECT
  USING (
    invited_by = auth.uid()
    OR team_id IN (SELECT id FROM innovation.teams WHERE leader_id = auth.uid())
    OR lower(invited_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS team_invitations_insert ON innovation.team_invitations;
CREATE POLICY team_invitations_insert ON innovation.team_invitations FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM innovation.teams WHERE leader_id = auth.uid())
  );

DROP POLICY IF EXISTS team_invitations_update ON innovation.team_invitations;
CREATE POLICY team_invitations_update ON innovation.team_invitations FOR UPDATE
  USING (
    team_id IN (SELECT id FROM innovation.teams WHERE leader_id = auth.uid())
    OR lower(invited_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- ip_signatures: any team member of the idea's team can insert/select their own sig
DROP POLICY IF EXISTS ip_signatures_select ON innovation.ip_signatures;
CREATE POLICY ip_signatures_select ON innovation.ip_signatures FOR SELECT
  USING (
    user_id = auth.uid()
    OR idea_id IN (
      SELECT i.id FROM innovation.ideas i
      JOIN innovation.team_members tm ON tm.team_id = i.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ip_signatures_insert ON innovation.ip_signatures;
CREATE POLICY ip_signatures_insert ON innovation.ip_signatures FOR INSERT
  WITH CHECK (user_id = auth.uid());
