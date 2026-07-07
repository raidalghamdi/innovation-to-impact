// Media assets: images/videos managed by admin from /admin/cms.
// Referenced from pages via slot_key. Files live in Supabase Storage bucket 'landing-media'.

import { createClient } from '@/lib/supabase/server';

export type MediaKind = 'image' | 'video';

export type MediaAsset = {
  id: string;
  slot_key: string;
  kind: MediaKind;
  url: string;
  poster_url: string | null;
  alt_ar: string | null;
  alt_en: string | null;
  page: string | null;
  section: string | null;
};

/**
 * Load one media asset by slot key. Returns null when missing or on error
 * (so pages fall back to their default asset).
 */
export async function loadMediaAsset(slotKey: string): Promise<MediaAsset | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('media_assets')
      .select('id,slot_key,kind,url,poster_url,alt_ar,alt_en,page,section')
      .eq('slot_key', slotKey)
      .maybeSingle();
    if (error) {
      console.error(`[loadMediaAsset:${slotKey}]`, error);
      return null;
    }
    return (data ?? null) as MediaAsset | null;
  } catch (err) {
    console.error(`[loadMediaAsset:${slotKey}] threw:`, err);
    return null;
  }
}

/**
 * Load every media asset (used by /admin/cms media tab).
 */
export async function loadAllMediaAssets(page?: string): Promise<MediaAsset[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    let query = supabase
      .from('media_assets')
      .select('id,slot_key,kind,url,poster_url,alt_ar,alt_en,page,section')
      .order('page', { ascending: true })
      .order('slot_key', { ascending: true });
    if (page) query = query.eq('page', page);
    const { data, error } = await query;
    if (error) {
      console.error('[loadAllMediaAssets]', error);
      return [];
    }
    return (data ?? []) as MediaAsset[];
  } catch (err) {
    console.error('[loadAllMediaAssets] threw:', err);
    return [];
  }
}
