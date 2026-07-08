'use client';

// Media editor — admin uploads/replaces images and videos referenced by pages via slot_key.

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Trash2, Plus, Check, ImageIcon, Film } from 'lucide-react';
import { createClient as createSupabaseBrowserClient } from '@supabase/supabase-js';

type Asset = {
  id: string;
  slot_key: string;
  kind: 'image' | 'video';
  url: string;
  poster_url: string | null;
  alt_ar: string | null;
  alt_en: string | null;
  page: string | null;
  section: string | null;
  updated_at: string;
};

// suggested slots the admin can quickly create if not present
const SUGGESTED_SLOTS: { slot_key: string; kind: 'image' | 'video'; page: string; label_ar: string; label_en: string }[] = [
  { slot_key: 'landing.hero.video',     kind: 'video', page: 'landing', label_ar: 'فيديو الهيرو (الصفحة الرئيسية)', label_en: 'Hero video (Landing)' },
  { slot_key: 'landing.hero.image',     kind: 'image', page: 'landing', label_ar: 'صورة الهيرو (الصفحة الرئيسية)', label_en: 'Hero image (Landing)' },
  { slot_key: 'landing.about.image',    kind: 'image', page: 'landing', label_ar: 'صورة "عن البرنامج"',            label_en: 'About section image' },
  { slot_key: 'landing.partners.logo1', kind: 'image', page: 'landing', label_ar: 'شعار شريك 1',                    label_en: 'Partner logo 1' },
  { slot_key: 'landing.partners.logo2', kind: 'image', page: 'landing', label_ar: 'شعار شريك 2',                    label_en: 'Partner logo 2' },
  { slot_key: 'landing.partners.logo3', kind: 'image', page: 'landing', label_ar: 'شعار شريك 3',                    label_en: 'Partner logo 3' },
  { slot_key: 'landing.partners.logo4', kind: 'image', page: 'landing', label_ar: 'شعار شريك 4',                    label_en: 'Partner logo 4' },
  { slot_key: 'landing.partners.logo5', kind: 'image', page: 'landing', label_ar: 'شعار شريك 5',                    label_en: 'Partner logo 5' },
  { slot_key: 'landing.partners.logo6', kind: 'image', page: 'landing', label_ar: 'شعار شريك 6',                    label_en: 'Partner logo 6' },
  { slot_key: 'landing.partners.logo7', kind: 'image', page: 'landing', label_ar: 'شعار شريك 7',                    label_en: 'Partner logo 7' },
  { slot_key: 'landing.partners.logo8', kind: 'image', page: 'landing', label_ar: 'شعار شريك 8',                    label_en: 'Partner logo 8' },
  // Previous edition (النسخة السابقة) — gallery images + a hero video.
  { slot_key: 'landing.previous.image1', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 1', label_en: 'Previous edition · image 1' },
  { slot_key: 'landing.previous.image2', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 2', label_en: 'Previous edition · image 2' },
  { slot_key: 'landing.previous.image3', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 3', label_en: 'Previous edition · image 3' },
  { slot_key: 'landing.previous.image4', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 4', label_en: 'Previous edition · image 4' },
  { slot_key: 'landing.previous.image5', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 5', label_en: 'Previous edition · image 5' },
  { slot_key: 'landing.previous.image6', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · صورة 6', label_en: 'Previous edition · image 6' },
  { slot_key: 'landing.previous.video',  kind: 'video', page: 'landing', label_ar: 'النسخة السابقة · فيديو', label_en: 'Previous edition · video' },
  { slot_key: 'landing.previous.video_poster', kind: 'image', page: 'landing', label_ar: 'النسخة السابقة · غلاف الفيديو', label_en: 'Previous edition · video poster' },
  { slot_key: 'stages.header.image',    kind: 'image', page: 'stages',  label_ar: 'رأس صفحة المراحل',               label_en: 'Stages page header' },
  { slot_key: 'about.header.image',     kind: 'image', page: 'about',   label_ar: 'رأس صفحة عن البرنامج',           label_en: 'About page header' },
];

export function MediaEditor({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/media');
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (err) {
      console.error('[media-editor] load', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadFile = async (
    slotKey: string,
    kind: 'image' | 'video',
    page: string,
    file: File,
  ) => {
    // Client-side pre-flight checks so we surface a helpful message BEFORE
    // uploading a large file and getting a generic server error.
    const MAX_BYTES = 500 * 1024 * 1024; // 500MB (Supabase bucket limit)
    if (file.size > MAX_BYTES) {
      alert(
        isAr
          ? `حجم الملف (${(file.size / 1024 / 1024).toFixed(1)}م.ب) أكبر من الحد المسموح 500م.ب. اضغط الفيديو أولاً (مثل HandBrake).`
          : `File (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 500MB limit. Compress the video first (e.g. HandBrake).`,
      );
      return;
    }
    // Supabase bucket accepts these MIME types — keep in sync with the
    // storage.buckets.allowed_mime_types on 'landing-media'.
    const ALLOWED_VIDEO = /^video\/(mp4|webm|quicktime|x-msvideo|x-matroska|ogg|mpeg|3gpp|3gpp2)$/;
    const ALLOWED_IMAGE = /^image\/(jpeg|png|webp|gif|svg\+xml|avif|heic|heif)$/;
    const allowed = kind === 'video' ? ALLOWED_VIDEO : ALLOWED_IMAGE;
    if (file.type && !allowed.test(file.type)) {
      const supportedList = kind === 'video'
        ? 'MP4, WebM, MOV, AVI, MKV, OGG, MPEG, 3GP'
        : 'JPG, PNG, WebP, GIF, SVG, AVIF, HEIC';
      alert(
        isAr
          ? `نوع الملف غير مدعوم (${file.type}). الأنواع المدعومة: ${supportedList}.`
          : `Unsupported file type (${file.type}). Supported: ${supportedList}.`,
      );
      return;
    }
    setBusy((prev) => ({ ...prev, [slotKey]: true }));
    try {
      // Vercel enforces ~4.5MB request body limit on API routes. Any file
      // larger than ~4MB — including nearly every hero video — must go
      // directly to Supabase Storage using a signed upload URL, then we
      // register the resulting public URL via the metadata endpoint.
      const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4MB, leaves headroom
      const useDirectUpload = file.size > VERCEL_BODY_LIMIT;

      if (useDirectUpload) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const signRes = await fetch('/api/admin/media/sign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot_key: slotKey, ext }),
        });
        const signData = await signRes.json().catch(() => ({}));
        if (!signRes.ok) throw new Error(signData.error || `sign_failed (HTTP ${signRes.status})`);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) throw new Error('supabase_env_missing');
        const sb = createSupabaseBrowserClient(supabaseUrl, anonKey);
        const { error: upErr } = await sb.storage
          .from('landing-media')
          .uploadToSignedUrl(signData.path, signData.token, file, {
            contentType: file.type || undefined,
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message || 'direct_upload_failed');

        // Register the public URL in media_assets via the JSON metadata path.
        const regRes = await fetch('/api/admin/media', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_key: slotKey,
            kind,
            url: signData.publicUrl,
            page,
          }),
        });
        const regData = await regRes.json().catch(() => ({}));
        if (!regRes.ok) throw new Error(regData.error || `register_failed (HTTP ${regRes.status})`);
      } else {
        // Small files: keep the simple single-request multipart path.
        const form = new FormData();
        form.append('file', file);
        form.append('slot_key', slotKey);
        form.append('kind', kind);
        form.append('page', page);
        const res = await fetch('/api/admin/media', { method: 'PUT', body: form });
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}` };
        }
        if (!res.ok) throw new Error(data.error || `upload_failed (HTTP ${res.status})`);
      }

      setFlash((prev) => ({ ...prev, [slotKey]: true }));
      setTimeout(() => setFlash((prev) => ({ ...prev, [slotKey]: false })), 2000);
      await load();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'unknown_error';
      alert((isAr ? 'فشل الرفع: ' : 'Upload failed: ') + msg);
    } finally {
      setBusy((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const removeAsset = async (slotKey: string) => {
    if (!confirm(isAr ? 'حذف هذه الوسيلة؟' : 'Delete this asset?')) return;
    setBusy((prev) => ({ ...prev, [slotKey]: true }));
    try {
      const res = await fetch(`/api/admin/media?slot_key=${encodeURIComponent(slotKey)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'delete_failed');
      await load();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'unknown_error';
      alert((isAr ? 'فشل الحذف: ' : 'Delete failed: ') + msg);
    } finally {
      setBusy((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const updateAltText = async (asset: Asset, patch: Partial<Asset>) => {
    const merged = { ...asset, ...patch };
    setAssets((prev) => prev.map((a) => (a.slot_key === asset.slot_key ? merged : a)));
    setBusy((prev) => ({ ...prev, [asset.slot_key]: true }));
    try {
      const res = await fetch('/api/admin/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_key: merged.slot_key,
          kind: merged.kind,
          url: merged.url,
          poster_url: merged.poster_url,
          alt_ar: merged.alt_ar,
          alt_en: merged.alt_en,
          page: merged.page,
          section: merged.section,
        }),
      });
      if (res.ok) {
        setFlash((prev) => ({ ...prev, [asset.slot_key]: true }));
        setTimeout(() => setFlash((prev) => ({ ...prev, [asset.slot_key]: false })), 1500);
      }
    } finally {
      setBusy((prev) => ({ ...prev, [asset.slot_key]: false }));
    }
  };

  // build the union of suggested + existing slots so admins see both
  const existingBySlot = new Map(assets.map((a) => [a.slot_key, a]));
  const displaySlots = [
    ...SUGGESTED_SLOTS.map((s) => ({
      ...s,
      asset: existingBySlot.get(s.slot_key) ?? null,
    })),
    // any existing that isn't in suggested
    ...assets
      .filter((a) => !SUGGESTED_SLOTS.find((s) => s.slot_key === a.slot_key))
      .map((a) => ({
        slot_key: a.slot_key,
        kind: a.kind,
        page: a.page || 'other',
        label_ar: a.slot_key,
        label_en: a.slot_key,
        asset: a,
      })),
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isAr
          ? 'ارفع صوراً (JPG/PNG/WebP/GIF/SVG/AVIF/HEIC) أو فيديو (MP4/WebM/MOV/AVI/MKV/OGG/MPEG/3GP). الحجم الأقصى 500 ميجابايت لكل ملف.'
          : 'Upload images (JPG/PNG/WebP/GIF/SVG/AVIF/HEIC) or video (MP4/WebM/MOV/AVI/MKV/OGG/MPEG/3GP). Max 500 MB per file.'}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {displaySlots.map((slot) => {
          const asset = slot.asset;
          const isBusy = busy[slot.slot_key];
          const isFlashing = flash[slot.slot_key];
          const Icon = slot.kind === 'video' ? Film : ImageIcon;
          return (
            <Card key={slot.slot_key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-teal" />
                    {isAr ? slot.label_ar : slot.label_en}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                    {slot.kind}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <code className="text-[11px]">{slot.slot_key}</code>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Preview */}
                {asset ? (
                  slot.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={(isAr ? asset.alt_ar : asset.alt_en) || slot.slot_key}
                      className="max-h-40 w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <video
                      src={asset.url}
                      poster={asset.poster_url || undefined}
                      controls
                      className="max-h-40 w-full rounded-lg border border-border"
                    />
                  )
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    {isAr ? 'لم يتم الرفع بعد — سيُستخدم الافتراضي' : 'Not uploaded — default will be used'}
                  </div>
                )}

                {/* Alt text (only when we have an asset) */}
                {asset && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">{isAr ? 'الوصف البديل (EN)' : 'Alt text (EN)'}</Label>
                      <Input
                        value={asset.alt_en ?? ''}
                        onChange={(e) =>
                          setAssets((prev) =>
                            prev.map((a) =>
                              a.slot_key === asset.slot_key ? { ...a, alt_en: e.target.value } : a,
                            ),
                          )
                        }
                        onBlur={(e) => updateAltText(asset, { alt_en: e.target.value })}
                      />
                    </div>
                    <div dir="rtl">
                      <Label className="text-xs">{isAr ? 'الوصف البديل (AR)' : 'Alt text (AR)'}</Label>
                      <Input
                        value={asset.alt_ar ?? ''}
                        onChange={(e) =>
                          setAssets((prev) =>
                            prev.map((a) =>
                              a.slot_key === asset.slot_key ? { ...a, alt_ar: e.target.value } : a,
                            ),
                          )
                        }
                        onBlur={(e) => updateAltText(asset, { alt_ar: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    ref={(el) => {
                      fileInputs.current[slot.slot_key] = el;
                    }}
                    type="file"
                    accept={slot.kind === 'image' ? 'image/*' : 'video/*'}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(slot.slot_key, slot.kind, slot.page, f);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputs.current[slot.slot_key]?.click()}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="ms-2">
                      {asset ? (isAr ? 'استبدال' : 'Replace') : isAr ? 'رفع' : 'Upload'}
                    </span>
                  </Button>
                  {asset && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAsset(slot.slot_key)}
                      disabled={isBusy}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ms-2">{isAr ? 'حذف' : 'Delete'}</span>
                    </Button>
                  )}
                  {isFlashing && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <Check className="h-4 w-4" />
                      {isAr ? 'محفوظ' : 'Saved'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
