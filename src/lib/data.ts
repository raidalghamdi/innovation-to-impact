// Data access layer. Reads from Supabase when configured, otherwise falls
// back to the demo dataset so the app renders fully during build/preview.
//
// Every fetch logs Supabase errors to stderr so that PostgREST / RLS / schema
// misconfigurations surface in Vercel logs instead of being silently masked
// by the demo fallback.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';

function logSupabaseError(fn: string, error: unknown) {
  if (!error) return;
  // Log the full error object; PostgREST returns { message, code, details, hint }.
  // eslint-disable-next-line no-console
  console.error(`[${fn}] supabase error:`, error);
}

export async function fetchIdeas() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    logSupabaseError('fetchIdeas', error);
    if (data && data.length) return data as unknown as demo.Idea[];
  }
  return demo.ideas;
}

export async function fetchThemes() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('strategic_themes').select('*');
    logSupabaseError('fetchThemes', error);
    if (data && data.length) return data as unknown as demo.StrategicTheme[];
  }
  return demo.themes;
}

export async function fetchActivities() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('activities').select('*');
    logSupabaseError('fetchActivities', error);
    if (data && data.length) return data as unknown as demo.Activity[];
  }
  return demo.activities;
}

export async function fetchCompliance() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('compliance_controls')
      .select('*')
      .order('regulator');
    logSupabaseError('fetchCompliance', error);
    if (data && data.length) return data as unknown as demo.ComplianceControl[];
  }
  return demo.compliance;
}

export async function fetchBenefits() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('benefits').select('*');
    logSupabaseError('fetchBenefits', error);
    if (data && data.length) return data as unknown as demo.Benefit[];
  }
  return demo.benefits;
}

export async function fetchKnowledge() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('knowledge_articles')
      .select('*')
      .order('published_at', { ascending: false });
    logSupabaseError('fetchKnowledge', error);
    if (data && data.length) return data as unknown as demo.KnowledgeArticle[];
  }
  return demo.knowledge;
}

export async function fetchUsers() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('user_profiles').select('*');
    logSupabaseError('fetchUsers', error);
    if (data && data.length) return data as unknown as demo.UserProfile[];
  }
  return demo.users;
}
