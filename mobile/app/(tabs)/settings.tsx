import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';
import { formatFileSize } from '../../src/utils/formatters';

export default function SettingsScreen() {
  const { user, logout, isBiometricAvailable, isBiometricEnabled, enableBiometric, disableBiometric } = useAuthStore();
  const { 
    isDarkMode, 
    theme, 
    setTheme, 
    cameraUpload, 
    setCameraUpload,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useSettingsStore();

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الخروج', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      disableBiometric();
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.section}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || 'المستخدم'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
        
        {/* Storage Info */}
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.storageTitle}>التخزين</Text>
            <Text style={styles.storageUsed}>
              {formatFileSize(user?.storageUsed || 0)} / غير محدود
            </Text>
          </View>
          <View style={styles.storageBar}>
            <View style={[styles.storageProgress, { width: '10%' }]} />
          </View>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المظهر</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="moon-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>الوضع</Text>
          </View>
          <View style={styles.settingRight}>
            <Text style={styles.settingValue}>
              {theme === 'light' ? 'فاتح' : theme === 'dark' ? 'داكن' : 'تلقائي'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الأمان</Text>
        
        {isBiometricAvailable && (
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print" size={22} color={COLORS.primary} />
              <Text style={styles.settingLabel}>تسجيل الدخول بالبصمة</Text>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: COLORS.border.light, true: COLORS.primary }}
            />
          </View>
        )}
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>تغيير كلمة المرور</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      {/* Sync */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المزامنة</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>رفع الصور تلقائياً</Text>
          </View>
          <Switch
            value={cameraUpload.wifiOnly !== undefined}
            onValueChange={(value) => setCameraUpload({ wifiOnly: value ? true : undefined })}
            trackColor={{ false: COLORS.border.light, true: COLORS.primary }}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="wifi-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>WiFi فقط</Text>
          </View>
          <Switch
            value={cameraUpload.wifiOnly}
            onValueChange={(value) => setCameraUpload({ wifiOnly: value })}
            trackColor={{ false: COLORS.border.light, true: COLORS.primary }}
          />
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الإشعارات</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>الإشعارات</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: COLORS.border.light, true: COLORS.primary }}
          />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>حول</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.primary} />
            <Text style={styles.settingLabel}>الإصدار</Text>
          </View>
          <Text style={styles.settingValue}>1.0.0</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${COLORS.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInfo: {
      marginLeft: 16,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    userEmail: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 2,
    },
    storageCard: {
      marginTop: 12,
      padding: 16,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 12,
    },
    storageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    storageTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    storageUsed: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    storageBar: {
      height: 6,
      backgroundColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
      borderRadius: 3,
    },
    storageProgress: {
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: 3,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 12,
      marginBottom: 8,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settingLabel: {
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    settingValue: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 32,
      marginHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: `${COLORS.error}10`,
      borderRadius: 12,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.error,
    },
  });
