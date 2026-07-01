// Gamification data access. All reads are best-effort: if Supabase is not
// configured (or the query fails) helpers return safe empty/zero values so the
// UI degrades gracefully.
import { createClient } from '@/lib/supabase/server';

export type Badge = {
  code: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  icon: string | null;
  points_reward: number | null;
};

export type EarnedBadge = Badge & { earned_at: string };

export type UserPoints = { points: number; level: number };

export async function getUserPoints(userId: string): Promise<UserPoints> {
  const supabase = await createClient();
  if (!supabase) return { points: 0, level: 1 };
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('points, level')
      .eq('id', userId)
      .maybeSingle();
    return {
      points: (data?.points as number) ?? 0,
      level: (data?.level as number) ?? 1,
    };
  } catch {
    return { points: 0, level: 1 };
  }
}

export async function getAllBadges(): Promise<Badge[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('badges')
      .select('code, name, name_ar, description, description_ar, icon, points_reward')
      .order('points_reward', { ascending: true });
    return (data as Badge[]) ?? [];
  } catch {
    return [];
  }
}

// Returns the set of badge codes the user has earned, keyed for quick lookup,
// plus the earned_at timestamp.
export async function getUserBadges(userId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  if (!supabase) return new Map();
  try {
    const { data } = await supabase
      .from('user_badges')
      .select('earned_at, badges(code)')
      .eq('user_id', userId);
    const map = new Map<string, string>();
    for (const row of (data as any[]) ?? []) {
      const code = row.badges?.code;
      if (code) map.set(code, row.earned_at);
    }
    return map;
  } catch {
    return new Map();
  }
}
