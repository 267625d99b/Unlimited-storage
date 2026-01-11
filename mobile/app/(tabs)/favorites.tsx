import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { filesApi } from '../../src/services/api';
import { COLORS } from '../../src/utils/constants';
import { formatFileSize, formatRelativeTime } from '../../src/utils/formatters';
import { getFileTypeInfo } from '../../src/utils/fileTypes';
import type { File } from '../../src/types';

export default function FavoritesScreen() {
  const { isDarkMode } = useSettingsStore();
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const data = await filesApi.getFavorites();
      setFiles(data);
    } catch (error) {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadFavorites();
    setIsRefreshing(false);
  };

  const handleItemPress = useCallback((file: File) => {
    router.push(`/file/${file.id}`);
  }, []);

  const handleRemoveFavorite = useCallback(async (file: File) => {
    try {
      await filesApi.toggleFavorite(file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      // Handle error
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: File }) => {
    const fileInfo = getFileTypeInfo(item.name, item.mimeType);

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${fileInfo?.color}20` }]}>
          <Ionicons
            name={(fileInfo?.icon as any) || 'document'}
            size={24}
            color={fileInfo?.color || COLORS.secondary}
          />
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemMeta, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            {formatFileSize(item.size)} • {formatRelativeTime(item.updatedAt)}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={() => handleRemoveFavorite(item)}
        >
          <Ionicons name="star" size={22} color={COLORS.warning} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [isDarkMode, handleItemPress, handleRemoveFavorite]);

  const styles = createStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : files.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="star-outline" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>لا توجد مفضلات</Text>
          <Text style={styles.emptySubtitle}>أضف ملفاتك المهمة للمفضلة للوصول السريع</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 8,
      textAlign: 'center',
    },
    listContent: {
      paddingBottom: 20,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
      marginLeft: 12,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '500',
    },
    itemMeta: {
      fontSize: 12,
      marginTop: 2,
    },
    favoriteButton: {
      padding: 8,
    },
  });
