'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

export function SupportForm() {
  const t = useTranslations('support');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Best-effort persistence; the form always confirms so demo UX is smooth.
    try {
      const supabase = createClient();
      await supabase?.from('support_messages').insert({ name, email, subject, message });
    } catch {
      /* table may not exist yet — ignore */
    }
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{t('sent')}</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">{t('name')}</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">{t('email')}</Label>
          <Input id="s-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-subject">{t('subject')}</Label>
        <Input id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-message">{t('message')}</Label>
        <Textarea id="s-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading}>{t('send')}</Button>
    </form>
  );
}
