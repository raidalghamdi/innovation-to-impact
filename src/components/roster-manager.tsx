'use client';

// src/components/roster-manager.tsx
// Client component for /admin/roster/[role].
// Two sections: Active members + Invitations.
// Supports bulk-select on invitations for reminders/withdraw, and an
// invite modal to send new invitations to any list of emails.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  UserPlus,
  Send,
  Bell,
  Trash2,
  Loader2,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ActiveMember = { id: string; email: string; name: string | null };
type Invitation = {
  id: string;
  token: string;
  role: string;
  target_email: string;
  target_name: string | null;
  status: string;
  deadline_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  created_at: string;
};

type Props = {
  role: string;
  roleName: string;
  activeMembers: ActiveMember[];
  invitations: Invitation[];
  locale: 'ar' | 'en';
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  viewed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-amber-50 text-amber-800 border-amber-200',
  withdrawn: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
};

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle2,
  declined: XCircle,
  expired: Clock,
  withdrawn: Ban,
};

export function RosterManager({
  role,
  roleName,
  activeMembers,
  invitations: initialInvitations,
  locale,
}: Props) {
  const t = useTranslations('roster');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------- Invite modal state ----------
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteDeadline, setInviteDeadline] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const activeInvIds = invitations
      .filter((i) => i.status !== 'accepted' && i.status !== 'declined' && i.status !== 'withdrawn')
      .map((i) => i.id);
    if (selected.size === activeInvIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeInvIds));
    }
  };

  const parseEmails = (raw: string): { email: string; name?: string }[] => {
    return raw
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        // Support "Name <email>" or "email"
        const m = entry.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
        if (m) return { email: m[2].trim(), name: m[1].trim() };
        return { email: entry };
      });
  };

  const sendInvites = async () => {
    const targets = parseEmails(inviteEmails);
    if (targets.length === 0) {
      showToast('err', t('errNoEmails'));
      return;
    }

    setBusy('invite');
    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          locale,
          targets,
          deadline_at: inviteDeadline || null,
          message: inviteMessage || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'send-failed');
      showToast('ok', t('inviteSent', { count: data.sent ?? targets.length }));
      setShowInvite(false);
      setInviteEmails('');
      setInviteDeadline('');
      setInviteMessage('');
      startTransition(() => router.refresh());
    } catch (e: any) {
      showToast('err', e.message || t('errGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const sendReminders = async () => {
    if (selected.size === 0) return;
    setBusy('remind');
    try {
      const res = await fetch('/api/admin/invitations/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'remind-failed');
      showToast('ok', t('remindersSent', { count: data.sent ?? selected.size }));
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (e: any) {
      showToast('err', e.message || t('errGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const withdrawSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(t('confirmWithdraw'))) return;
    setBusy('withdraw');
    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action: 'withdraw' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'withdraw-failed');
      showToast('ok', t('withdrawDone', { count: data.updated ?? selected.size }));
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (e: any) {
      showToast('err', e.message || t('errGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const fmtDate = (s: string | null) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return s;
    }
  };

  const stats = useMemo(() => {
    return {
      active: activeMembers.length,
      pending: invitations.filter(
        (i) => i.status === 'sent' || i.status === 'viewed' || i.status === 'pending'
      ).length,
      accepted: invitations.filter((i) => i.status === 'accepted').length,
      declined: invitations.filter((i) => i.status === 'declined').length,
    };
  }, [activeMembers, invitations]);

  return (
    <div className="mt-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            locale === 'ar' ? 'left-4' : 'right-4'
          } ${
            toast.kind === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">{t('activeMembers')}</div>
          <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">{t('pending')}</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">{t('accepted')}</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.accepted}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-slate-500">{t('declined')}</div>
          <div className="text-2xl font-bold text-rose-600">{stats.declined}</div>
        </CardContent></Card>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setShowInvite(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t('inviteNew')}
        </Button>
        <Button
          variant="outline"
          disabled={selected.size === 0 || busy === 'remind'}
          onClick={sendReminders}
          className="gap-2"
        >
          {busy === 'remind' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {t('sendReminders')} {selected.size > 0 && `(${selected.size})`}
        </Button>
        <Button
          variant="outline"
          disabled={selected.size === 0 || busy === 'withdraw'}
          onClick={withdrawSelected}
          className="gap-2 text-rose-700 hover:bg-rose-50"
        >
          {busy === 'withdraw' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {t('withdraw')} {selected.size > 0 && `(${selected.size})`}
        </Button>
      </div>

      {/* Active members */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">{t('activeMembers')}</h2>
            <p className="text-xs text-slate-500">{t('activeMembersDesc', { role: roleName })}</p>
          </div>
          {activeMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t('noActiveMembers')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-start">{t('name')}</th>
                    <th className="px-4 py-2 text-start">{t('email')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900">{m.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{m.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitations */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">{t('invitations')}</h2>
            <p className="text-xs text-slate-500">{t('invitationsDesc')}</p>
          </div>
          {invitations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t('noInvitations')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={
                          selected.size > 0 &&
                          selected.size ===
                            invitations.filter(
                              (i) => i.status !== 'accepted' && i.status !== 'declined' && i.status !== 'withdrawn'
                            ).length
                        }
                        onChange={toggleAll}
                        aria-label="select all"
                      />
                    </th>
                    <th className="px-4 py-2 text-start">{t('email')}</th>
                    <th className="px-4 py-2 text-start">{t('name')}</th>
                    <th className="px-4 py-2 text-start">{t('status')}</th>
                    <th className="px-4 py-2 text-start">{t('deadline')}</th>
                    <th className="px-4 py-2 text-start">{t('reminders')}</th>
                    <th className="px-4 py-2 text-start">{t('sentAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => {
                    const Icon = STATUS_ICON[inv.status] ?? Mail;
                    const canSelect =
                      inv.status !== 'accepted' &&
                      inv.status !== 'declined' &&
                      inv.status !== 'withdrawn';
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          {canSelect && (
                            <input
                              type="checkbox"
                              checked={selected.has(inv.id)}
                              onChange={() => toggleOne(inv.id)}
                              aria-label={`select ${inv.target_email}`}
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-900">{inv.target_email}</td>
                        <td className="px-4 py-2 text-slate-700">{inv.target_name ?? '—'}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[inv.status] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {t(`status_${inv.status}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{fmtDate(inv.deadline_at)}</td>
                        <td className="px-4 py-2 text-slate-600">{inv.reminder_count}</td>
                        <td className="px-4 py-2 text-slate-600">{fmtDate(inv.sent_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !busy && setShowInvite(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">
              {t('inviteNew')} · {roleName}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{t('inviteHelp')}</p>

            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="emails">{t('inviteEmailsLabel')}</Label>
                <Textarea
                  id="emails"
                  rows={5}
                  placeholder={'user1@gac.gov.sa\nName <user2@gac.gov.sa>'}
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="deadline">{t('deadline')}</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={inviteDeadline}
                  onChange={(e) => setInviteDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="message">{t('customMessage')}</Label>
                <Textarea
                  id="message"
                  rows={3}
                  placeholder={t('customMessagePh')}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowInvite(false)}
                disabled={!!busy}
              >
                {t('cancel')}
              </Button>
              <Button onClick={sendInvites} disabled={!!busy} className="gap-2">
                {busy === 'invite' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('sendInvites')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
