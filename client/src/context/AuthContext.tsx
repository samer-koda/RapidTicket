import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setToken } from '../api';

interface User { id: string; name: string; role: string; }
interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  login: (pin: string) => Promise<void>;
  loginDirect: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null, token: null, initialized: false,
  login: async () => {}, loginDirect: () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('rt_session');
    if (saved) {
      try {
        const { token: t, user: u } = JSON.parse(saved);
        setTokenState(t);
        setUser(u);
        setToken(t);
      } catch { /* ignore */ }
    }
    setInitialized(true);
  }, []);

  const login = useCallback(async (pin: string) => {
    const res = await api.auth.login(pin);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    sessionStorage.setItem('rt_session', JSON.stringify({ token: res.token, user: res.user }));
  }, []);

  const loginDirect = useCallback((token: string, user: User) => {
    setToken(token);
    setTokenState(token);
    setUser(user);
    sessionStorage.setItem('rt_session', JSON.stringify({ token, user }));
  }, []);

  const logout = useCallback(() => {
    api.auth.logout().catch(() => {});
    setToken(null);
    setTokenState(null);
    setUser(null);
    sessionStorage.removeItem('rt_session');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, initialized, login, loginDirect, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
