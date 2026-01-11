import { create } from 'zustand';
import { Appearance } from 'react-native';
import { settingsStorage } from '../services/storage';
import type { ThemeMode, Settings, CameraUploadOptions } from '../types';

interface SettingsState {
  theme: ThemeMode;
  isDarkMode: boolean;
  cameraUpload: CameraUploadOptions;
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  isLoading: boolean;
}

interface SettingsActions {
  loadSettings: () => void;
  setTheme: (theme: ThemeMode) => void;
  setCameraUpload: (options: Partial<CameraUploadOptions>) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  viewMode: 'list',
  sortBy: 'name',
  sortOrder: 'asc',
  cameraUpload: {
    wifiOnly: true,
    includeVideos: true,
    targetFolderId: undefined,
  },
  biometricEnabled: false,
  notificationsEnabled: true,
};

const getIsDarkMode = (theme: ThemeMode): boolean => {
  if (theme === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return theme === 'dark';
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // State
  theme: DEFAULT_SETTINGS.theme,
  isDarkMode: getIsDarkMode(DEFAULT_SETTINGS.theme),
  cameraUpload: DEFAULT_SETTINGS.cameraUpload,
  biometricEnabled: DEFAULT_SETTINGS.biometricEnabled,
  notificationsEnabled: DEFAULT_SETTINGS.notificationsEnabled,
  isLoading: true,

  // Actions
  loadSettings: () => {
    const saved = settingsStorage.getSettings<Settings>();
    if (saved) {
      set({
        theme: saved.theme || DEFAULT_SETTINGS.theme,
        isDarkMode: getIsDarkMode(saved.theme || DEFAULT_SETTINGS.theme),
        cameraUpload: saved.cameraUpload || DEFAULT_SETTINGS.cameraUpload,
        biometricEnabled: saved.biometricEnabled ?? DEFAULT_SETTINGS.biometricEnabled,
        notificationsEnabled: saved.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }

    // Listen for system theme changes
    Appearance.addChangeListener(({ colorScheme }) => {
      const { theme } = get();
      if (theme === 'system') {
        set({ isDarkMode: colorScheme === 'dark' });
      }
    });
  },

  setTheme: (theme: ThemeMode) => {
    settingsStorage.updateSettings({ theme });
    set({
      theme,
      isDarkMode: getIsDarkMode(theme),
    });
  },

  setCameraUpload: (options: Partial<CameraUploadOptions>) => {
    const { cameraUpload } = get();
    const updated = { ...cameraUpload, ...options };
    settingsStorage.updateSettings({ cameraUpload: updated });
    set({ cameraUpload: updated });
  },

  setBiometricEnabled: (enabled: boolean) => {
    settingsStorage.updateSettings({ biometricEnabled: enabled });
    set({ biometricEnabled: enabled });
  },

  setNotificationsEnabled: (enabled: boolean) => {
    settingsStorage.updateSettings({ notificationsEnabled: enabled });
    set({ notificationsEnabled: enabled });
  },

  resetSettings: () => {
    settingsStorage.setSettings(DEFAULT_SETTINGS);
    set({
      theme: DEFAULT_SETTINGS.theme,
      isDarkMode: getIsDarkMode(DEFAULT_SETTINGS.theme),
      cameraUpload: DEFAULT_SETTINGS.cameraUpload,
      biometricEnabled: DEFAULT_SETTINGS.biometricEnabled,
      notificationsEnabled: DEFAULT_SETTINGS.notificationsEnabled,
    });
  },
}));
