'use client';

import { useState } from 'react';
import { FileDown } from 'lucide-react';

// POSTs to the committee-pack PDF route and triggers a browser download of the
// returned blob. Used from the committee session page where the route needs a
// body (sessionDate + ideaIds) rather than a plain GET link.
export function CommitteePackButton({
  ideaIds,
  locale,
  label,
  sessionDate,
}: {
  ideaIds: string[];
  locale: string;
  label: string;
  sessionDate?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy || !ideaIds.length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/exports/committee-pack.pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaIds,
          locale,
          sessionDate: sessionDate ?? new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `committee-pack-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || !ideaIds.length}
      className="inline-flex items-center gap-2 rounded-md bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      <FileDown className="h-4 w-4" />
      {label}
    </button>
  );
}
