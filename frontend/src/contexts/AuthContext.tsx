import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/* ── Types ───────────────────────────────────────────────────── */

interface User {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

/* ── Context ─────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'idap_token';

/* ── Provider ────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  /* ── Persist / clear token in localStorage ───────────────── */
  const saveToken = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  /* ── Validate token on mount ─────────────────────────────── */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data: User = await res.json();
          setUser(data);
        } else {
          clearSession();
        }
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clearSession]);

  /* ── Login ───────────────────────────────────────────────── */
  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          return { success: false, error: data?.detail || 'Invalid email or password' };
        }

        const data = await res.json();
        saveToken(data.access_token);
        setUser(data.user);
        return { success: true };
      } catch {
        return { success: false, error: 'Network error. Please try again.' };
      }
    },
    [saveToken],
  );

  /* ── Register ────────────────────────────────────────────── */
  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          // Extract the first validation error message if present
          let errorMsg = 'Registration failed';
          if (data?.detail) {
            if (typeof data.detail === 'string') {
              errorMsg = data.detail;
            } else if (Array.isArray(data.detail) && data.detail.length > 0) {
              errorMsg = data.detail[0]?.msg?.replace('Value error, ', '') || errorMsg;
            }
          }
          return { success: false, error: errorMsg };
        }

        const data = await res.json();
        saveToken(data.access_token);
        setUser(data.user);
        return { success: true };
      } catch {
        return { success: false, error: 'Network error. Please try again.' };
      }
    },
    [saveToken],
  );

  /* ── Logout ──────────────────────────────────────────────── */
  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Proceed with local logout even if server call fails
      }
    }
    clearSession();
  }, [token, clearSession]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
