import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { COLORS } from '../src/utils/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const { checkAuth, checkBiometric } = useAuthStore();
  const { loadSettings, isDarkMode } = useSettingsStore();

  useEffect(() => {
    // Initialize app
    loadSettings();
    checkAuth();
    checkBiometric();
  }, []);

  const backgroundColor = isDarkMode ? COLORS.background.dark : COLORS.background.light;
  const textColor = isDarkMode ? COLORS.text.dark : COLORS.text.light;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor,
          },
          headerTintColor: textColor,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="(auth)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="file/[id]" 
          options={{ 
            title: 'معاينة الملف',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="folder/[id]" 
          options={{ title: 'مجلد' }} 
        />
      </Stack>
    </QueryClientProvider>
  );
}
