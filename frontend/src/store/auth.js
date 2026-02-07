import { create } from 'zustand';
import api from '../utils/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const getStoredToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

const getStoredUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

export const useAuthStore = create((set, get) => ({
  isAuthenticated: !!getStoredToken(),
  user: getStoredUser(),
  isLoading: false,
  error: null,

  checkAuthStatus: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/api/auth/status');
      const user = response.data.user;
      set({
        isAuthenticated: true,
        user,
        isLoading: false,
      });
      setStoredUser(user);
      return response.data;
    } catch (error) {
      // Token might be invalid, clear it
      setStoredToken(null);
      setStoredUser(null);
      set({
        isAuthenticated: false,
        user: null,
        error: (typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : error.response?.data?.error?.message) || 'Failed to check auth status',
        isLoading: false,
      });
      return null;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      setStoredToken(token);
      setStoredUser(user);
      
      set({
        isAuthenticated: true,
        user,
        isLoading: false,
        error: null,
      });
      return response.data;
    } catch (error) {
      set({
        error: (typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : error.response?.data?.error?.message) || 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout error:', error);
    } finally {
      setStoredToken(null);
      setStoredUser(null);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
