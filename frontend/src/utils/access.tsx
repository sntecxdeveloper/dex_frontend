import { createContext, useContext } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import type { MyAccess } from '../api/accessApi';

/** What the signed-in person may open and change, as set by an administrator (Setup → Roles). Provided by MainLayout. */
export const AccessContext = createContext<MyAccess | null>(null);

export type SetupLevel = 'HIDDEN' | 'VIEW' | 'FULL';

/** Pages under Setup that a role can be given, by the key the server uses. */
export const SETUP_PAGES = ['setup-categories', 'setup-incident-form', 'setup-automation', 'setup-notifications', 'setup-chat'] as const;

/** Which Setup page each address belongs to. Addresses not listed here (mail, users, roles...) are for administrators only. */
const SETUP_PAGE_OF: [string, (typeof SETUP_PAGES)[number]][] = [
  ['/setup/categories', 'setup-categories'],
  ['/setup/service-category', 'setup-categories'],
  ['/setup/incident-form', 'setup-incident-form'],
  ['/setup/automation/life-cycles', 'setup-automation'],
  ['/setup/automation/sla', 'setup-automation'],
  ['/setup/automation/business-rules', 'setup-automation'],
  ['/setup/automation/notification-templates', 'setup-notifications'],
  ['/setup/automation/notification-rules', 'setup-notifications'],
  ['/setup/chat', 'setup-chat'],
];

export const setupPageOf = (path?: string): (typeof SETUP_PAGES)[number] | undefined =>
  path ? SETUP_PAGE_OF.find(([p]) => path === p || path.startsWith(`${p}?`))?.[1] : undefined;

export function useSetupAccess() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const access = useContext(AccessContext);
  const isAdmin = role === 'ROLE_ADMIN';
  const level = (page: string): SetupLevel => (isAdmin ? 'FULL' : (access?.pages[page] as SetupLevel | undefined) ?? 'HIDDEN');
  const canEdit = (page: string) => isAdmin || (level(page) === 'FULL' && access?.actions[`${page}.edit`] === true);
  /** Whether the person has any Setup page at all (shows the Setup entry). */
  const hasAnySetup = isAdmin || SETUP_PAGES.some((p) => level(p) !== 'HIDDEN');
  return { isAdmin, level, canEdit, hasAnySetup };
}
