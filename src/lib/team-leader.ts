// Unified team-leader source (R42-later Item 7). The ONLY code path dashboards
// use to resolve "قائد الفريق / Team Leader" for an idea. Reads the
// innovation.v_team_leader view (00035), which falls back to the submitter for
// individual ideas and joins the leader's email + display name.
//
// Consumers: innovator, supervisor, admin dashboards. NOT the evaluator
// dashboard (evaluators must not see team/leader identity).
import { createClient } from '@/lib/supabase/server';

export type TeamLeader = { leaderId: string; email: string; name: string };

type LeaderRow = {
  idea_id: string;
  leader_id: string | null;
  leader_email: string | null;
  leader_name: string | null;
};

function toTeamLeader(row: LeaderRow): TeamLeader | null {
  if (!row.leader_id) return null;
  return {
    leaderId: row.leader_id,
    email: row.leader_email ?? '',
    name: row.leader_name ?? row.leader_email ?? '',
  };
}

export async function getTeamLeader(ideaId: string): Promise<TeamLeader | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('v_team_leader')
      .select('idea_id, leader_id, leader_email, leader_name')
      .eq('idea_id', ideaId)
      .maybeSingle();
    if (error || !data) return null;
    return toTeamLeader(data as LeaderRow);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getTeamLeader] threw:', err);
    return null;
  }
}

export async function getTeamLeadersBatch(
  ideaIds: string[]
): Promise<Map<string, TeamLeader>> {
  const result = new Map<string, TeamLeader>();
  if (ideaIds.length === 0) return result;
  const supabase = await createClient();
  if (!supabase) return result;
  try {
    const { data, error } = await supabase
      .from('v_team_leader')
      .select('idea_id, leader_id, leader_email, leader_name')
      .in('idea_id', ideaIds);
    if (error || !data) return result;
    for (const row of data as LeaderRow[]) {
      const leader = toTeamLeader(row);
      if (leader) result.set(row.idea_id, leader);
    }
    return result;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getTeamLeadersBatch] threw:', err);
    return result;
  }
}
