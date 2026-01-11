import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

export interface ActionSheetOption {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: ActionSheetOption[];
  isDarkMode?: boolean;
}

export default function ActionSheet({
  visible,
  onClose,
  title,
  options,
  isDarkMode = false,
}: ActionSheetProps) {
  const styles = createStyles(isDarkMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}
          
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  option.disabled && styles.optionDisabled,
                  index === options.length - 1 && styles.lastOption,
                ]}
                onPress={() => {
                  if (!option.disabled) {
                    onClose();
                    option.onPress();
                  }
                }}
                disabled={option.disabled}
              >
                <Ionicons
                  name={option.icon as any}
                  size={22}
                  color={
                    option.disabled
                      ? COLORS.secondary
                      : option.destructive
                      ? COLORS.error
                      : COLORS.primary
                  }
                />
                <Text
                  style={[
                    styles.optionText,
                    option.destructive && styles.destructiveText,
                    option.disabled && styles.disabledText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
    },
    header: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      textAlign: 'center',
    },
    optionsContainer: {
      paddingVertical: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      gap: 14,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    lastOption: {
      borderBottomWidth: 0,
    },
    optionText: {
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    destructiveText: {
      color: COLORS.error,
    },
    disabledText: {
      color: COLORS.secondary,
    },
    cancelButton: {
      marginTop: 8,
      marginHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.primary,
    },
  });
