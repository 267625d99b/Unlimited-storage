import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';
import { ActivityIndicator, View } from 'react-native';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isDarkMode } = useSettingsStore();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Redirect to main app if authenticated
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const backgroundColor = isDarkMode ? COLORS.background.dark : COLORS.background.light;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
