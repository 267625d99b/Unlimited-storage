import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../utils/constants';

// Initialize MMKV storage
export const storage = new MMKV();

/**
 * Secure storage for sensitive data (tokens, etc.)
 */
export const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async get(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  },

  async delete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

/**
 * Regular storage for non-sensitive data
 */
export const appStorage = {
  set(key: string, value: string): void {
    storage.set(key, value);
  },

  get(key: string): string | undefined {
    return storage.getString(key);
  },

  setObject<T>(key: string, value: T): void {
    storage.set(key, JSON.stringify(value));
  },

  getObject<T>(key: string): T | null {
    const value = storage.getString(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  delete(key: string): void {
    storage.delete(key);
  },

  clear(): void {
    storage.clearAll();
  },

  getAllKeys(): string[] {
    return storage.getAllKeys();
  },
};

/**
 * Auth token management
 */
export const tokenStorage = {
  async setTokens(token: string, refreshToken: string): Promise<void> {
    await secureStorage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    await secureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  },

  async getToken(): Promise<string | null> {
    return await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return await secureStorage.get(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await secureStorage.delete(STORAGE_KEYS.AUTH_TOKEN);
    await secureStorage.delete(STORAGE_KEYS.REFRESH_TOKEN);
  },
};

/**
 * User data storage
 */
export const userStorage = {
  setUser(user: object): void {
    appStorage.setObject(STORAGE_KEYS.USER, user);
  },

  getUser<T>(): T | null {
    return appStorage.getObject<T>(STORAGE_KEYS.USER);
  },

  clearUser(): void {
    appStorage.delete(STORAGE_KEYS.USER);
  },
};

/**
 * Settings storage
 */
export const settingsStorage = {
  setSettings(settings: object): void {
    appStorage.setObject(STORAGE_KEYS.SETTINGS, settings);
  },

  getSettings<T>(): T | null {
    return appStorage.getObject<T>(STORAGE_KEYS.SETTINGS);
  },

  updateSettings(updates: object): void {
    const current = this.getSettings<object>() || {};
    this.setSettings({ ...current, ...updates });
  },
};

/**
 * Cache management
 */
export const cacheStorage = {
  set(key: string, value: unknown, ttl?: number): void {
    const item = {
      value,
      expiresAt: ttl ? Date.now() + ttl : null,
    };
    appStorage.setObject(key, item);
  },

  get<T>(key: string): T | null {
    const item = appStorage.getObject<{ value: T; expiresAt: number | null }>(key);
    if (!item) return null;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      appStorage.delete(key);
      return null;
    }
    
    return item.value;
  },

  delete(key: string): void {
    appStorage.delete(key);
  },

  clearExpired(): void {
    const keys = appStorage.getAllKeys();
    keys.forEach(key => {
      const item = appStorage.getObject<{ expiresAt: number | null }>(key);
      if (item?.expiresAt && Date.now() > item.expiresAt) {
        appStorage.delete(key);
      }
    });
  },
};
