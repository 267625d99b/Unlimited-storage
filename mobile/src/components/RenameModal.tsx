import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../utils/constants';

interface RenameModalProps {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  isDarkMode?: boolean;
}

export default function RenameModal({
  visible,
  currentName,
  onClose,
  onRename,
  isDarkMode = false,
}: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(currentName);
      setError(null);
    }
  }, [visible, currentName]);

  const handleRename = async () => {
    if (!name.trim()) {
      setError('يرجى إدخال اسم');
      return;
    }

    if (name.trim() === currentName) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onRename(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل في إعادة التسمية');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>إعادة التسمية</Text>
          
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder="الاسم الجديد"
            placeholderTextColor={COLORS.secondary}
            autoFocus
            selectTextOnFocus
          />
          
          {error && <Text style={styles.errorText}>{error}</Text>}
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.confirmButton, (!name.trim() || isLoading) && styles.disabledButton]}
              onPress={handleRename}
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmText}>تأكيد</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginBottom: 16,
      textAlign: 'center',
    },
    input: {
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    inputError: {
      borderColor: COLORS.error,
    },
    errorText: {
      color: COLORS.error,
      fontSize: 13,
      marginTop: 8,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 20,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
    },
    confirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
