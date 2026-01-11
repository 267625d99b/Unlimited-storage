import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import { authApi } from '../services/api';
import { tokenStorage, userStorage, appStorage } from '../services/storage';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkBiometric: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  loginWithBiometric: () => Promise<boolean>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isBiometricAvailable: false,
  isBiometricEnabled: false,
  error: null,

  // Actions
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(email, password);
      await tokenStorage.setTokens(response.token, response.refreshToken);
      userStorage.setUser(response.user);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'فشل تسجيل الدخول',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.register(username, email, password);
      await tokenStorage.setTokens(response.token, response.refreshToken);
      userStorage.setUser(response.user);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'فشل إنشاء الحساب',
        isLoading: false,
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      await tokenStorage.clearTokens();
      userStorage.clearUser();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      // Try to get user profile
      const user = await authApi.getProfile();
      userStorage.setUser(user);
      
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await tokenStorage.clearTokens();
      userStorage.clearUser();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  checkBiometric: async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isBiometricEnabled = appStorage.get('biometric_enabled') === 'true';
      
      set({
        isBiometricAvailable: hasHardware && isEnrolled,
        isBiometricEnabled: isBiometricEnabled && hasHardware && isEnrolled,
      });
    } catch {
      set({ isBiometricAvailable: false, isBiometricEnabled: false });
    }
  },

  enableBiometric: async () => {
    const { isBiometricAvailable } = get();
    if (!isBiometricAvailable) return;

    // Verify biometric first
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'تأكيد الهوية لتفعيل تسجيل الدخول البيومتري',
      fallbackLabel: 'استخدم كلمة المرور',
    });

    if (result.success) {
      appStorage.set('biometric_enabled', 'true');
      set({ isBiometricEnabled: true });
    }
  },

  disableBiometric: () => {
    appStorage.delete('biometric_enabled');
    set({ isBiometricEnabled: false });
  },

  loginWithBiometric: async () => {
    const { isBiometricEnabled, checkAuth } = get();
    if (!isBiometricEnabled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'تسجيل الدخول باستخدام البصمة',
      fallbackLabel: 'استخدم كلمة المرور',
    });

    if (result.success) {
      // Check if we have a valid token
      const token = await tokenStorage.getToken();
      if (token) {
        await checkAuth();
        return true;
      }
    }

    return false;
  },

  clearError: () => set({ error: null }),
}));
