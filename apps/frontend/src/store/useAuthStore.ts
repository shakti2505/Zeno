import { create } from 'zustand';
import api from '../lib/api';

export interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/auth/me');
      const user = response.data?.data?.user;
      if (user) {
        set({
          user: {
            id: user.id || user._id,
            email: user.email,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      // 401 or no active session
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const user = response.data?.data?.user;
      set({
        user: {
          id: user.id || user._id,
          email: user.email,
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to sign in. Please check your credentials.',
        isLoading: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', { email, password });
      const user = response.data?.data?.user;
      set({
        user: {
          id: user.id || user._id,
          email: user.email,
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Registration failed. Please try again.',
        isLoading: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },
}));

export default useAuthStore;
