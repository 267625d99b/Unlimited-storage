import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, loginWithBiometric, isLoading, error, isBiometricEnabled, clearError } = useAuthStore();
  const { isDarkMode } = useSettingsStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {
      // Error is handled in store
    }
  };

  const handleBiometricLogin = async () => {
    const success = await loginWithBiometric();
    if (success) {
      router.replace('/(tabs)');
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="cloud" size={80} color={COLORS.primary} />
          <Text style={styles.title}>التخزين السحابي</Text>
          <Text style={styles.subtitle}>تسجيل الدخول للمتابعة</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور"
              placeholderTextColor={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>تسجيل الدخول</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login */}
          {isBiometricEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
            >
              <Ionicons name="finger-print" size={24} color={COLORS.primary} />
              <Text style={styles.biometricText}>تسجيل الدخول بالبصمة</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Register Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ليس لديك حساب؟</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>إنشاء حساب</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 16,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 8,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: `${COLORS.error}20`,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    errorText: {
      color: COLORS.error,
      flex: 1,
    },
    form: {
      gap: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      height: 50,
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      textAlign: 'right',
    },
    button: {
      backgroundColor: COLORS.primary,
      height: 50,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    biometricText: {
      color: COLORS.primary,
      fontSize: 16,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 32,
      gap: 8,
    },
    footerText: {
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    linkText: {
      color: COLORS.primary,
      fontWeight: '600',
    },
  });
