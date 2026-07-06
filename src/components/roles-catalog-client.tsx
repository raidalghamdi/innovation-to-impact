'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleIcon } from '@/lib/role-icons';
import { Lock, Plus, Trash2, Check, X } from 'lucide-react';

type DbRole = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
};

// src/components/roles-catalog-client.tsx:1
// Phase 11.4 — edit-in-place table for innovation.roles. System roles cannot
// be deleted (only edited); non-system unreferenced roles can be deleted.
export function RolesCatalogClient({ locale, initialRoles }: { locale: string; initialRoles: DbRole[] }) {
  const isAr = locale === 'ar';
  const [roles, setRoles] = useState<DbRole[]>(initialRoles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DbRole>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name_ar: '', name_en: '' });
  const [error, setError] = useState<string | null>(null);

  function startEdit(role: DbRole) {
    setEditingId(role.id);
    setDraft({ ...role });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_ar: draft.name_ar,
          name_en: draft.name_en,
          description_ar: draft.description_ar,
          description_en: draft.description_en,
          sort_order: draft.sort_order,
          is_active: draft.is_active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'error');
        return;
      }
      setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...json.role } : r)));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(role: DbRole) {
    const res = await fetch(`/api/admin/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !role.is_active }),
    });
    if (res.ok) {
      setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, is_active: !role.is_active } : r)));
    }
  }

  async function deleteRole(role: DbRole) {
    if (role.is_system) return;
    if (!confirm(isAr ? `حذف دور "${role.name_ar}"؟` : `Delete role "${role.name_en}"?`)) return;
    const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(
        json.error === 'role_in_use'
          ? isAr
            ? 'لا يمكن الحذف — الدور مستخدم من قبل مستخدمين أو موظفين'
            : 'Cannot delete — role is in use by users or employees'
          : json.error ?? 'error'
      );
      return;
    }
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
  }

  async function addRole() {
    if (!newRole.code || !newRole.name_ar || !newRole.name_en) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'error');
        return;
      }
      setRoles((prev) => [...prev, json.role].sort((a, b) => a.sort_order - b.sort_order));
      setNewRole({ code: '', name_ar: '', name_en: '' });
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="h-4 w-4" />
          {isAr ? 'إضافة دور' : 'Add role'}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4 sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{isAr ? 'الرمز' : 'Code'}</label>
              <Input
                value={newRole.code}
                onChange={(e) => setNewRole((r) => ({ ...r, code: e.target.value }))}
                placeholder="mentor"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{isAr ? 'الاسم بالعربي' : 'Name (Arabic)'}</label>
              <Input value={newRole.name_ar} onChange={(e) => setNewRole((r) => ({ ...r, name_ar: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{isAr ? 'الاسم بالإنجليزي' : 'Name (English)'}</label>
              <Input value={newRole.name_en} onChange={(e) => setNewRole((r) => ({ ...r, name_en: e.target.value }))} />
            </div>
            <Button onClick={addRole} disabled={saving}>
              <Check className="h-4 w-4" />
              {isAr ? 'حفظ' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="teal-header">
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'الدور' : 'Role'}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'الاسم بالعربي' : 'Name (AR)'}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'الاسم بالإنجليزي' : 'Name (EN)'}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'الترتيب' : 'Order'}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'مفعّل' : 'Active'}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const Icon = getRoleIcon(role.code);
                const isEditing = editingId === role.id;
                return (
                  <tr key={role.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-brand-teal" />
                        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {role.code}
                        </span>
                        {role.is_system && <Lock className="h-3 w-3 text-muted-foreground" aria-label={isAr ? 'دور نظام' : 'System role'} />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input
                          value={draft.name_ar ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, name_ar: e.target.value }))}
                        />
                      ) : (
                        role.name_ar
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input
                          value={draft.name_en ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))}
                        />
                      ) : (
                        role.name_en
                      )}
                    </td>
                    <td className="px-4 py-3 w-20">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={draft.sort_order ?? 0}
                          onChange={(e) => setDraft((d) => ({ ...d, sort_order: parseInt(e.target.value, 10) || 0 }))}
                        />
                      ) : (
                        role.sort_order
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={role.is_active}
                        onClick={() => toggleActive(role)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          role.is_active ? 'bg-brand-teal' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            role.is_active ? 'translate-x-1 rtl:-translate-x-1' : 'translate-x-6 rtl:-translate-x-6'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(role.id)} disabled={saving}>
                            <Check className="h-4 w-4 text-brand-teal" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(role)}
                            className="text-sm font-medium text-brand-teal hover:underline"
                          >
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          {!role.is_system && (
                            <button
                              type="button"
                              onClick={() => deleteRole(role)}
                              className="inline-flex items-center gap-1 text-sm font-medium text-destructive hover:underline"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isAr ? 'حذف' : 'Delete'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
