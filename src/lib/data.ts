// Data access layer. Reads from Supabase when configured, otherwise falls
// back to the demo dataset so the app renders fully during build/preview.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';

export async function fetchIdeas() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length) return data as unknown as demo.Idea[];
  }
  return demo.ideas;
}

export async function fetchThemes() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!.from('strategic_themes').select('*');
    if (data && data.length) return data as unknown as demo.StrategicTheme[];
  }
  return demo.themes;
}

export async function fetchActivities() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!.from('activities').select('*');
    if (data && data.length) return data as unknown as demo.Activity[];
  }
  return demo.activities;
}

export async function fetchCompliance() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!
      .from('compliance_controls')
      .select('*')
      .order('regulator');
    if (data && data.length) return data as unknown as demo.ComplianceControl[];
  }
  return demo.compliance;
}

export async function fetchBenefits() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!.from('benefits').select('*');
    if (data && data.length) return data as unknown as demo.Benefit[];
  }
  return demo.benefits;
}

export async function fetchKnowledge() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!
      .from('knowledge_articles')
      .select('*')
      .order('published_at', { ascending: false });
    if (data && data.length) return data as unknown as demo.KnowledgeArticle[];
  }
  return demo.knowledge;
}

export async function fetchUsers() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!.from('user_profiles').select('*');
    if (data && data.length) return data as unknown as demo.UserProfile[];
  }
  return demo.users;
}
