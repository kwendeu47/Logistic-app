import { create } from "zustand";
import * as authApi from "../api/auth.api";
import { getAccessToken, setAccessToken, setRefreshToken, setUnauthorizedHandler } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrating: true,
  isAuthenticated: false,

  hydrate: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ isHydrating: false });
      return;
    }

    try {
      const { user } = await authApi.getMe();
      set({ user, isAuthenticated: true, isHydrating: false });
    } catch {
      await setAccessToken(null);
      await setRefreshToken(null);
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);
    await setAccessToken(result.accessToken);
    if (result.refreshToken) await setRefreshToken(result.refreshToken);
    set({ user: result.user, isAuthenticated: true });
  },

  register: async (input) => {
    const result = await authApi.register(input);
    await setAccessToken(result.accessToken);
    if (result.refreshToken) await setRefreshToken(result.refreshToken);
    set({ user: result.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors on logout
    }
    await setAccessToken(null);
    await setRefreshToken(null);
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});
