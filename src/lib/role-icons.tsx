import { Lightbulb, Gavel, Users2, ShieldCheck, Settings2, type LucideIcon } from 'lucide-react';

// src/lib/role-icons.tsx:1
// Shared role -> icon/color mapping used by the role selection screen and
// the header role switcher, so both stay visually consistent.
export const ROLE_ICON: Record<string, LucideIcon> = {
  innovator: Lightbulb,
  judge: Gavel,
  committee: Users2,
  supervisor: ShieldCheck,
  admin: Settings2,
};

export function getRoleIcon(code: string): LucideIcon {
  return ROLE_ICON[code] ?? Lightbulb;
}
