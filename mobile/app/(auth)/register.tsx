import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS } from '../../src/utils/constants';
import Toast, { ToastType } from '../../src/components/Toast';

export default function RegisterScreen() {
  const { isDarkMode } = useSettingsStore();
  const { register, isLoading } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({ visible: false, message: '', type: 'error' });

  const backgroundColor = isDarkMode ? COLORS.background.dark : COLORS.background.light;
  const textColor = isDarkMode ? COLORS.text.dark : COLORS.text.light;
  const inputBg = isDarkMode ? COLORS.surface.dark : COLORS.surface.light;
  const borderColor = isDarkMode ? COLORS.border.dark : COLORS.border.light;

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setToast({ visible: true, message: 'يرجى ملء جميع الحقول', type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setToast({ visible: true, message: 'كلمات المرور غير متطابقة', type: 'error' });
      return;
    }

    if (password.length < 6) {
      setToast({ visible: true, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', type: 'error' });
      return;
    }

    const success = await register(username, email, password);
    if (success) {
      setToast({ visible: true, message: 'تم إنشاء الحساب بنجاح', type: 'success' });
      router.replace('/(tabs)');
    } else {
      setToast({ visible: true, message: 'فشل في إنشاء الحساب', type: 'error' });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Ionicons name="cloud" size={80} color={COLORS.primary} />
          <Text style={[styles.title, { color: textColor }]}>إنشاء حساب جديد</Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            أنشئ حسابك للبدء
          </Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
            <Ionicons name="person-outline" size={20} color={COLORS.primary} />
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="اسم المستخدم"
              placeholderTextColor={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
            <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
            <TextInput
              style={[styles.input, { color: textColor }]}
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
                color={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="تأكيد كلمة المرور"
              placeholderTextColor={isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>إنشاء حساب</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text style={[styles.loginLinkText, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
              لديك حساب؟{' '}
              <Text style={{ color: COLORS.primary }}>تسجيل الدخول</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    textAlign: 'right',
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
  },
});
