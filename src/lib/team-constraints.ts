// R44 Item 1: shared team-size constraints. Imported by both idea forms and the
// server-side resubmit route so the client and server agree on the cap.
//
// A team is 3 to 5 people total, inclusive. The submitter always counts as one
// member (the implicit team leader), so the ADDITIONAL members stored in the
// ideas.team_members JSONB array range from 2 (minimum) to 4 (maximum).
export const MIN_TEAM_TOTAL = 3;
export const MAX_TEAM_TOTAL = 5;

export const MIN_ADDITIONAL_MEMBERS = MIN_TEAM_TOTAL - 1; // 2
export const MAX_ADDITIONAL_MEMBERS = MAX_TEAM_TOTAL - 1; // 4
