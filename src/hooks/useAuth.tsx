import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { auth, tokenStore, type AuthUser, type Capability, type CapabilityAction } from '@/api';
import { setUnauthorizedHandler } from '@/api/http';
import { can, SCOPE_BY_ROLE, scopeFilter } from '@/rbac/matrix';

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the stored session has been read — guards render a spinner. */
  initialising: boolean;
  signIn: (userName: string, password: string, remember?: boolean) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  /** Capability check against the Section 07 matrix. */
  can: (capability: Capability, action?: CapabilityAction) => boolean;
  /** `{ subGroupId }` for an Event Team user, `{}` for the Main Admin. */
  scope: { subGroupId?: number };
  isGlobal: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  /* Restore a session from storage on first paint. */
  useEffect(() => {
    const stored = tokenStore.read();
    if (stored && stored.user?.userId) setUserState(stored.user);
    setInitialising(false);
  }, []);

  /* Any 401 anywhere in the app drops the session exactly once. */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUserState(null);
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const signIn = useCallback(async (userName: string, password: string, remember = false) => {
    const account = await auth.login(userName, password, remember);
    setUserState(account);
    return account;
  }, []);

  const signOut = useCallback(async () => {
    await auth.logout();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? 'Public';
    return {
      user,
      initialising,
      signIn,
      signOut,
      setUser: setUserState,
      can: (capability, action = 'view') => can(role, capability, action),
      scope: scopeFilter(role, user?.subGroupId ?? null),
      isGlobal: SCOPE_BY_ROLE[role] === 'Global',
    };
  }, [user, initialising, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
