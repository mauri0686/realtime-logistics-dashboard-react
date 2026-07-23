/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, onUnauthorized, tokenStorage } from '../api/client';
import type { LoginResponse } from '../types/shipment';

const USER_KEY = 'shiptrack.user';

interface AuthContextValue {
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth state lives in context so any component can read it without prop drilling; the memoised
 * value keeps consumers from re-rendering unless the session actually changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  // Any 401 from the API (expired/invalid token) force-logs-out, app-wide.
  useEffect(() => onUnauthorized(logout), [logout]);

  const login = useCallback(async (user: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/api/auth/login', {
      username: user,
      password,
    });
    tokenStorage.set(data.token);
    localStorage.setItem(USER_KEY, data.username);
    setToken(data.token);
    setUsername(data.username);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ username, isAuthenticated: token !== null, login, logout }),
    [username, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
