import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  isDarkMode?: boolean;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  isDarkMode = false,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={64} color={COLORS.secondary} />
      <Text style={[styles.title, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
