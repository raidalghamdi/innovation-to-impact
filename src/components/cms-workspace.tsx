'use client';

// CMS workspace with two tabs: text blocks (existing CmsEditor) and media assets.

import { useState } from 'react';
import { CmsEditor } from '@/components/cms-editor';
import { MediaEditor } from '@/components/media-editor';
import { FileText, ImageIcon } from 'lucide-react';

export function CmsWorkspace({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [tab, setTab] = useState<'text' | 'media'>('text');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-1">
        <button
          onClick={() => setTab('text')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            tab === 'text'
              ? 'bg-brand-teal text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          {isAr ? 'النصوص والأقسام' : 'Text & sections'}
        </button>
        <button
          onClick={() => setTab('media')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            tab === 'media'
              ? 'bg-brand-teal text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          {isAr ? 'الوسائط (صور وفيديو)' : 'Media (images & video)'}
        </button>
      </div>

      {tab === 'text' ? <CmsEditor locale={locale} /> : <MediaEditor locale={locale} />}
    </div>
  );
}
