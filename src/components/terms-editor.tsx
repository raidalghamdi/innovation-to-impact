'use client';

/**
 * /admin/terms — editor for the public Terms & Conditions content.
 *
 * Two independent locale editors (Arabic + English), each backed by its own
 * innovation.terms_content row. Content is lightweight markdown (## headings +
 * blank-line-separated paragraphs); a toggle renders a live preview using the
 * same <TermsContent /> renderer the public page uses. Each locale saves on its
 * own via PUT /api/admin/terms.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TermsContent } from '@/components/terms-content';
import { Check, Loader2, Eye, Pencil, AlertCircle } from 'lucide-react';

type LocaleKey = 'ar' | 'en';
type Status = 'idle' | 'saving' | 'saved' | 'error';

function LocaleEditor({
  locale,
  initial,
  heading,
  dir,
}: {
  locale: LocaleKey;
  initial: string;
  heading: string;
  dir: 'rtl' | 'ltr';
}) {
  const t = useTranslations('adminTerms');
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  async function save() {
    setStatus('saving');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/terms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, content: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || 'error');
        setStatus('error');
        return;
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setErrorMsg('network');
      setStatus('error');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{heading}</h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? t('edit') : t('preview')}
          </Button>
        </div>

        {preview ? (
          <div className="min-h-[16rem] rounded-md border border-border bg-white p-4">
            {value.trim() ? (
              <TermsContent content={value} dir={dir} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('previewEmpty')}</p>
            )}
          </div>
        ) : (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={18}
            dir={dir}
            className="font-mono text-sm"
          />
        )}

        <p className="text-xs text-muted-foreground">{t('markdownHint')}</p>

        {status === 'error' && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t('saveError')} {errorMsg ? `(${errorMsg})` : ''}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="button" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'saved' && <Check className="h-4 w-4" />}
            {t('save')}
          </Button>
          {status === 'saved' && (
            <span className="text-xs font-medium text-brand-teal">{t('saved')}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TermsEditor({
  locale,
  initialAr,
  initialEn,
}: {
  locale: string;
  initialAr: string;
  initialEn: string;
}) {
  const t = useTranslations('adminTerms');
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <LocaleEditor locale="ar" initial={initialAr} heading={t('arabic')} dir="rtl" />
      <LocaleEditor locale="en" initial={initialEn} heading={t('english')} dir="ltr" />
    </div>
  );
}
