import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// 1. IMPORT THE CONFIG
import { API_BASE_URL } from '../config'; 

interface User {
  id: string;
  email: string;
  role: string;
  telegramConnected: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        // 2. USE API_BASE_URL INSTEAD OF LOCALHOST
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        set({ user: data.user, token: data.token });
      },

      register: async (email, password) => {
        // 3. USE API_BASE_URL INSTEAD OF LOCALHOST
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      },

      logout: () => set({ user: null, token: null }),

      refreshUser: async () => {
        const { token } = get();
        if (!token) return;
        // 4. USE API_BASE_URL INSTEAD OF LOCALHOST
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const user = await res.json();
          set({ user });
        }
      }
    }),
    { name: 'sentry-auth' }
  )
);