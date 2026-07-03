import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '../types/schema';

const STORAGE_KEY = 'lan-designer:role';

interface RoleContextValue {
  role: Role | null;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Role | null) ?? null;
  });

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole: (nextRole: Role) => {
        localStorage.setItem(STORAGE_KEY, nextRole);
        setRoleState(nextRole);
      },
      clearRole: () => {
        localStorage.removeItem(STORAGE_KEY);
        setRoleState(null);
      },
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return ctx;
}
