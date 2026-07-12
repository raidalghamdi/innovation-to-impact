'use client';

// Manage Tracks (innovation.strategic_themes). Rendered inside the Phase
// Scheduling page for admin AND supervisor. Both roles may add/edit/delete any
// track via /api/admin/tracks.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';

export type Track = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
};

type Draft = { name_ar: string; name_en: string; description_ar: string; description_en: string };

const EMPTY: Draft = { name_ar: '', name_en: '', description_ar: '', description_en: '' };

export function TracksManager({ locale, initialTracks }: { locale: string; initialTracks: Track[] }) {
  const t = useTranslations('tracksManager');
  const isAr = locale === 'ar';
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [creating, setCreating] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!creating.name_ar.trim() || !creating.name_en.trim()) {
      setError(t('errNames'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creating),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'error');
      setTracks((prev) => [...prev, data.track]);
      setCreating(EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(track: Track) {
    setEditingId(track.id);
    setEditDraft({
      name_ar: track.name_ar ?? '',
      name_en: track.name_en ?? '',
      description_ar: track.description_ar ?? '',
      description_en: track.description_en ?? '',
    });
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'error');
      setTracks((prev) => prev.map((tr) => (tr.id === id ? data.track : tr)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('confirmDelete'))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tracks/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'error');
      setTracks((prev) => prev.filter((tr) => tr.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-brand-teal">{t('title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Existing tracks */}
        <ul className="space-y-3">
          {tracks.length === 0 && <li className="text-sm text-muted-foreground">{t('empty')}</li>}
          {tracks.map((track) => (
            <li key={track.id} className="rounded-lg border border-border p-3">
              {editingId === track.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>{t('nameAr')}</Label>
                      <Input
                        value={editDraft.name_ar}
                        onChange={(e) => setEditDraft({ ...editDraft, name_ar: e.target.value })}
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label>{t('nameEn')}</Label>
                      <Input
                        value={editDraft.name_en}
                        onChange={(e) => setEditDraft({ ...editDraft, name_en: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>{t('descAr')}</Label>
                      <Input
                        value={editDraft.description_ar}
                        onChange={(e) => setEditDraft({ ...editDraft, description_ar: e.target.value })}
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label>{t('descEn')}</Label>
                      <Input
                        value={editDraft.description_en}
                        onChange={(e) => setEditDraft({ ...editDraft, description_en: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(track.id)} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t('save')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={busy}>
                      <X className="h-4 w-4" />
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {(isAr ? track.name_ar : track.name_en) || track.name_en || track.name_ar || '—'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {(isAr ? track.description_ar : track.description_en) || ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(track)} disabled={busy}>
                      <Pencil className="h-4 w-4" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => remove(track.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('delete')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Add new track */}
        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{t('addTitle')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('nameAr')}</Label>
              <Input value={creating.name_ar} onChange={(e) => setCreating({ ...creating, name_ar: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label>{t('nameEn')}</Label>
              <Input value={creating.name_en} onChange={(e) => setCreating({ ...creating, name_en: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>{t('descAr')}</Label>
              <Input value={creating.description_ar} onChange={(e) => setCreating({ ...creating, description_ar: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label>{t('descEn')}</Label>
              <Input value={creating.description_en} onChange={(e) => setCreating({ ...creating, description_en: e.target.value })} dir="ltr" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={create} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('addButton')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
