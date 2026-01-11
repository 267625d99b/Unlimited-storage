import { Stack } from 'expo-router';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';

export default function FileLayout() {
  const { isDarkMode } = useSettingsStore();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
        },
        headerTintColor: isDarkMode ? COLORS.text.dark : COLORS.text.light,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitle: 'رجوع',
      }}
    />
  );
}
