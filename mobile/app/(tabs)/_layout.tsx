import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';
import { ActivityIndicator, View } from 'react-native';

export default function TabsLayout() {
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const backgroundColor = isDarkMode ? COLORS.background.dark : COLORS.background.light;
  const textColor = isDarkMode ? COLORS.text.dark : COLORS.text.light;
  const inactiveColor = isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor,
          borderTopColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
        },
        headerStyle: {
          backgroundColor,
        },
        headerTintColor: textColor,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ملفاتي',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'بحث',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'المفضلة',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: 'مشترك',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="share-social" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
