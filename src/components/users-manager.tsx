'use client';

// src/components/users-manager.tsx
// Full user management UI: search + filters, KPI strip, table with inline
// actions (edit / roles / reset pw / deactivate / reactivate / delete),
// and a modal to create a new user.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  UserPlus,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  Pencil,
  Loader2,
  MoreVertical,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Shield,
  Copy,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = { id: string; code: string; name_ar: string | null; name_en: string | null };
type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  full_name_ar: string | null;
  department: string | null;
  phone: string | null;
  organization: string | null;
  user_category: 'internal' | 'external';
  language_preference: string;
  must_change_password: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_active: boolean;
  roles: { code: string; name_ar: string | null; name_en: string | null; is_primary: boolean }[];
};

type Props = {
  users: UserRow[];
  roles: Role[];
  kpi: {
    total: number;
    active: number;
    inactive: number;
    internal: number;
    external: number;
    mustChangePw: number;
  };
  locale: 'ar' | 'en';
};

const KPI_ITEMS: Array<{
  key: keyof Props['kpi'];
  ar: string;
  en: string;
  icon: any;
  tone: string;
}> = [
  { key: 'total', ar: 'الإجمالي', en: 'Total', icon: UsersIcon, tone: 'text-slate-900' },
  { key: 'active', ar: 'نشط', en: 'Active', icon: UserCheck, tone: 'text-emerald-600' },
  { key: 'inactive', ar: 'معطّل', en: 'Inactive', icon: UserX, tone: 'text-rose-600' },
  { key: 'internal', ar: 'داخلي', en: 'Internal', icon: Shield, tone: 'text-teal-700' },
  { key: 'external', ar: 'خارجي', en: 'External', icon: UsersIcon, tone: 'text-amber-600' },
  { key: 'mustChangePw', ar: 'تغيير كلمة المرور', en: 'Must change pw', icon: KeyRound, tone: 'text-indigo-600' },
];

export function UsersManager({ users, roles, kpi, locale }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<{ email: string; pw: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (query) {
        const q = query.toLowerCase();
        const hay = `${u.full_name ?? ''} ${u.full_name_ar ?? ''} ${u.email ?? ''} ${u.department ?? ''} ${u.organization ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter) {
        if (!u.roles.some((r) => r.code === roleFilter)) return false;
      }
      if (categoryFilter !== 'all' && u.user_category !== categoryFilter) return false;
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      return true;
    });
  }, [users, query, roleFilter, categoryFilter, statusFilter]);

  const fmtDate = (s: string | null) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString(isAr ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return s;
    }
  };

  // --- Actions ---
  const resetPassword = async (u: UserRow) => {
    if (!confirm(isAr ? `إعادة تعيين كلمة مرور ${u.email}؟` : `Reset password for ${u.email}?`)) return;
    setBusy('rp-' + u.id);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowPw({ email: u.email, pw: data.temporaryPassword ?? 'Demo2026!' });
    } catch (e: any) {
      showToast('err', e.message);
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = async (u: UserRow, action: 'deactivate' | 'reactivate' | 'delete') => {
    const messages = {
      deactivate: isAr ? `تعطيل ${u.email}؟` : `Deactivate ${u.email}?`,
      reactivate: isAr ? `تفعيل ${u.email}؟` : `Reactivate ${u.email}?`,
      delete: isAr
        ? `⚠️ حذف نهائي لـ ${u.email}؟ لا يمكن التراجع.`
        : `⚠️ Permanently delete ${u.email}? This cannot be undone.`,
    };
    if (!confirm(messages[action])) return;
    setBusy(`${action}-${u.id}`);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(
        'ok',
        action === 'delete'
          ? isAr ? 'حُذف نهائياً.' : 'Deleted.'
          : action === 'deactivate'
          ? isAr ? 'تم التعطيل.' : 'Deactivated.'
          : isAr ? 'أُعيد التفعيل.' : 'Reactivated.'
      );
      startTransition(() => router.refresh());
    } catch (e: any) {
      showToast('err', e.message);
    } finally {
      setBusy(null);
    }
  };

  const copyPw = () => {
    if (!showPw) return;
    navigator.clipboard.writeText(showPw.pw);
    showToast('ok', isAr ? 'نُسخت كلمة المرور.' : 'Password copied.');
  };

  const primaryRole = (u: UserRow) =>
    u.roles.find((r) => r.is_primary) ?? u.roles[0];

  return (
    <div className="mt-6 space-y-6">
      {toast && (
        <div
          className={`fixed top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            isAr ? 'left-4' : 'right-4'
          } ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KPI_ITEMS.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg bg-slate-50 p-2 ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">{isAr ? k.ar : k.en}</div>
                  <div className={`text-xl font-bold ${k.tone}`}>{kpi[k.key]}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isAr ? 'right-3' : 'left-3'}`} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? 'ابحث بالاسم أو البريد أو القسم…' : 'Search name, email, or department…'}
            aria-label={isAr ? 'ابحث بالاسم أو البريد أو القسم' : 'Search name, email, or department'}
            className={isAr ? 'pr-9' : 'pl-9'}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          aria-label={isAr ? 'تصفية حسب الدور' : 'Filter by role'}
        >
          <option value="">{isAr ? 'كل الأدوار' : 'All roles'}</option>
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {isAr ? r.name_ar ?? r.code : r.name_en ?? r.code}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          aria-label={isAr ? 'تصفية حسب الفئة' : 'Filter by category'}
        >
          <option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>
          <option value="internal">{isAr ? 'داخلي' : 'Internal'}</option>
          <option value="external">{isAr ? 'خارجي' : 'External'}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          aria-label={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="inactive">{isAr ? 'معطّل' : 'Inactive'}</option>
        </select>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {isAr ? 'مستخدم جديد' : 'New user'}
        </Button>
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'الأدوار' : 'Roles'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'الفئة' : 'Category'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'القسم' : 'Department'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'آخر دخول' : 'Last login'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="w-16 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {isAr ? 'لا نتائج.' : 'No results.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const pRole = primaryRole(u);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {(isAr ? u.full_name_ar : u.full_name) ?? u.full_name ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              u.roles.map((r) => (
                                <span
                                  key={r.code}
                                  className={`rounded-full border px-2 py-0.5 text-xs ${
                                    r.is_primary
                                      ? 'border-teal-600 bg-teal-50 text-teal-700 font-medium'
                                      : 'border-slate-200 bg-white text-slate-600'
                                  }`}
                                >
                                  {isAr ? r.name_ar ?? r.code : r.name_en ?? r.code}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`rounded px-2 py-0.5 ${
                              u.user_category === 'internal'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {u.user_category === 'internal'
                              ? isAr ? 'داخلي' : 'Internal'
                              : isAr ? 'خارجي' : 'External'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{u.department ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(u.last_sign_in_at)}</td>
                        <td className="px-4 py-3">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              {isAr ? 'نشط' : 'Active'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                              <Ban className="h-3 w-3" />
                              {isAr ? 'معطّل' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                              className="rounded p-1 hover:bg-slate-100"
                              aria-label="actions"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-500" />
                            </button>
                            {openMenu === u.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenMenu(null)}
                                />
                                <div
                                  className={`absolute z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg ${
                                    isAr ? 'left-0' : 'right-0'
                                  }`}
                                >
                                  <button
                                    onClick={() => { setEditRow(u); setOpenMenu(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                                  >
                                    <Pencil className="h-4 w-4 text-slate-500" />
                                    {isAr ? 'تعديل بياناته' : 'Edit profile'}
                                  </button>
                                  <a
                                    href={`/${locale}/admin/users/${u.id}`}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                                  >
                                    <Shield className="h-4 w-4 text-slate-500" />
                                    {isAr ? 'إدارة الأدوار' : 'Manage roles'}
                                  </a>
                                  <button
                                    onClick={() => resetPassword(u)}
                                    disabled={busy === 'rp-' + u.id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                                  >
                                    {busy === 'rp-' + u.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <KeyRound className="h-4 w-4 text-indigo-600" />
                                    )}
                                    {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
                                  </button>
                                  {u.is_active ? (
                                    <button
                                      onClick={() => changeStatus(u, 'deactivate')}
                                      disabled={busy === 'deactivate-' + u.id}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                                    >
                                      <Ban className="h-4 w-4 text-amber-600" />
                                      {isAr ? 'تعطيل الحساب' : 'Deactivate'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => changeStatus(u, 'reactivate')}
                                      disabled={busy === 'reactivate-' + u.id}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                      {isAr ? 'إعادة التفعيل' : 'Reactivate'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => changeStatus(u, 'delete')}
                                    disabled={busy === 'delete-' + u.id}
                                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {isAr ? 'حذف نهائي' : 'Delete permanently'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-3 text-center text-xs text-slate-500">
            {isAr
              ? `يظهر ${filtered.length} من ${users.length} مستخدماً`
              : `Showing ${filtered.length} of ${users.length} users`}
          </div>
        </CardContent>
      </Card>

      {/* Password reveal modal */}
      {showPw && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {isAr ? 'كلمة المرور المؤقتة' : 'Temporary password'}
              </h3>
              <button onClick={() => setShowPw(null)} className="rounded p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {isAr
                ? `تم توليد كلمة مرور مؤقتة لـ ${showPw.email}. سيُطلب منه تغييرها عند الدخول.`
                : `A temporary password was set for ${showPw.email}. They will be asked to change it on next login.`}
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 p-3">
              <code className="flex-1 font-mono text-lg font-bold text-slate-900">{showPw.pw}</code>
              <Button variant="outline" size="sm" onClick={copyPw} className="gap-2">
                <Copy className="h-4 w-4" />
                {isAr ? 'نسخ' : 'Copy'}
              </Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setShowPw(null)}>{isAr ? 'حسناً' : 'Done'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* New-user modal */}
      {showNew && (
        <NewUserModal
          roles={roles}
          locale={locale}
          onClose={() => setShowNew(false)}
          onCreated={(msg) => {
            showToast('ok', msg);
            setShowNew(false);
            startTransition(() => router.refresh());
          }}
          onError={(msg) => showToast('err', msg)}
        />
      )}

      {/* Edit-profile modal */}
      {editRow && (
        <EditProfileModal
          user={editRow}
          locale={locale}
          onClose={() => setEditRow(null)}
          onSaved={(msg) => {
            showToast('ok', msg);
            setEditRow(null);
            startTransition(() => router.refresh());
          }}
          onError={(msg) => showToast('err', msg)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-modals (kept in same file so state doesn't need lifting)
// ============================================================================

function NewUserModal({
  roles,
  locale,
  onClose,
  onCreated,
  onError,
}: {
  roles: Role[];
  locale: 'ar' | 'en';
  onClose: () => void;
  onCreated: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isAr = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    full_name_ar: '',
    department: '',
    phone: '',
    organization: '',
    user_category: 'internal' as 'internal' | 'external',
    roleCode: 'innovator',
  });
  const [createdPw, setCreatedPw] = useState<string | null>(null);

  const submit = async () => {
    if (!form.email || !form.full_name) {
      onError(isAr ? 'البريد والاسم مطلوبان.' : 'Email and name are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          roleCodes: [form.roleCode],
          primaryRoleCode: form.roleCode,
          sendInvite: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreatedPw(data.temporaryPassword ?? 'Demo2026!');
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (createdPw) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-emerald-700">
            {isAr ? '✓ تم إنشاء المستخدم' : '✓ User created'}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {isAr
              ? `أرسل كلمة المرور التالية إلى ${form.email}. سيُطلب منه تغييرها عند أول دخول.`
              : `Share this password with ${form.email}. They will be asked to change it on first login.`}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 p-3">
            <code className="flex-1 font-mono text-lg font-bold text-slate-900">{createdPw}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(createdPw);
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              {isAr ? 'نسخ' : 'Copy'}
            </Button>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => onCreated(isAr ? 'تم إنشاء المستخدم.' : 'User created.')}>
              {isAr ? 'انتهيت' : 'Done'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {isAr ? 'إضافة مستخدم جديد' : 'Add new user'}
          </h3>
          <button onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>{isAr ? 'الاسم بالإنجليزي' : 'Full name (EN)'} *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'الاسم بالعربي' : 'Full name (AR)'}</Label>
            <Input
              dir="rtl"
              value={form.full_name_ar}
              onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })}
            />
          </div>
          <div>
            <Label>{isAr ? 'البريد الإلكتروني' : 'Email'} *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
            />
          </div>
          <div>
            <Label>{isAr ? 'رقم الجوال' : 'Phone'}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'القسم' : 'Department'}</Label>
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'الجهة' : 'Organization'}</Label>
            <Input
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </div>
          <div>
            <Label>{isAr ? 'الفئة' : 'Category'}</Label>
            <select
              value={form.user_category}
              onChange={(e) => setForm({ ...form, user_category: e.target.value as any })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="internal">{isAr ? 'داخلي (@gac.gov.sa)' : 'Internal (@gac.gov.sa)'}</option>
              <option value="external">{isAr ? 'خارجي' : 'External'}</option>
            </select>
          </div>
          <div>
            <Label>{isAr ? 'الدور الأساسي' : 'Primary role'}</Label>
            <select
              value={form.roleCode}
              onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {isAr ? r.name_ar ?? r.code : r.name_en ?? r.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {isAr
            ? 'سيُضبط كلمة مرور مؤقتة (Demo2026!) ويُطلب من المستخدم تغييرها عند أول دخول.'
            : 'A temporary password (Demo2026!) will be set and the user will be asked to change it on first login.'}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isAr ? 'إنشاء' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditProfileModal({
  user,
  locale,
  onClose,
  onSaved,
  onError,
}: {
  user: UserRow;
  locale: 'ar' | 'en';
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isAr = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: user.full_name ?? '',
    full_name_ar: user.full_name_ar ?? '',
    department: user.department ?? '',
    phone: user.phone ?? '',
    organization: user.organization ?? '',
    user_category: user.user_category,
    language_preference: user.language_preference,
  });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(isAr ? 'حُفظت البيانات.' : 'Saved.');
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isAr ? 'تعديل بيانات المستخدم' : 'Edit user profile'}
            </h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>{isAr ? 'الاسم بالإنجليزي' : 'Full name (EN)'}</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'الاسم بالعربي' : 'Full name (AR)'}</Label>
            <Input
              dir="rtl"
              value={form.full_name_ar}
              onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })}
            />
          </div>
          <div>
            <Label>{isAr ? 'رقم الجوال' : 'Phone'}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'القسم' : 'Department'}</Label>
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? 'الجهة' : 'Organization'}</Label>
            <Input
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </div>
          <div>
            <Label>{isAr ? 'الفئة' : 'Category'}</Label>
            <select
              value={form.user_category}
              onChange={(e) => setForm({ ...form, user_category: e.target.value as any })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="internal">{isAr ? 'داخلي' : 'Internal'}</option>
              <option value="external">{isAr ? 'خارجي' : 'External'}</option>
            </select>
          </div>
          <div>
            <Label>{isAr ? 'اللغة المفضّلة' : 'Preferred language'}</Label>
            <select
              value={form.language_preference}
              onChange={(e) => setForm({ ...form, language_preference: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {isAr ? 'حفظ' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
