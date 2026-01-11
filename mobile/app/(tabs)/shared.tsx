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
import { sharingApi } from '../../src/services/api';
import { COLORS } from '../../src/utils/constants';
import { formatFileSize, formatRelativeTime } from '../../src/utils/formatters';
import { getFileTypeInfo } from '../../src/utils/fileTypes';
import type { SharedFile, ShareLink } from '../../src/types';

type TabType = 'with-me' | 'by-me';

export default function SharedScreen() {
  const { isDarkMode } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('with-me');
  const [sharedWithMe, setSharedWithMe] = useState<SharedFile[]>([]);
  const [sharedByMe, setSharedByMe] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'with-me') {
        const data = await sharingApi.getSharedWithMe();
        setSharedWithMe(data);
      } else {
        const data = await sharingApi.getSharedByMe();
        setSharedByMe(data);
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleItemPress = useCallback((fileId: string) => {
    router.push(`/file/${fileId}`);
  }, []);

  const renderSharedWithMeItem = useCallback(({ item }: { item: SharedFile }) => {
    const fileInfo = getFileTypeInfo(item.file.name, item.file.mimeType);

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleItemPress(item.file.id)}
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
            {item.file.name}
          </Text>
          <Text style={[styles.itemMeta, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            من {item.sharedBy.username} • {formatRelativeTime(item.sharedAt)}
          </Text>
        </View>
        
        <View style={[styles.permissionBadge, { backgroundColor: getPermissionColor(item.permission) }]}>
          <Text style={styles.permissionText}>
            {getPermissionLabel(item.permission)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [isDarkMode, handleItemPress]);

  const renderSharedByMeItem = useCallback(({ item }: { item: ShareLink }) => {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleItemPress(item.fileId)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${COLORS.primary}20` }]}>
          <Ionicons name="link" size={24} color={COLORS.primary} />
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]} numberOfLines={1}>
            رابط مشاركة
          </Text>
          <Text style={[styles.itemMeta, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            {item.downloadCount} تحميل • {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        
        {item.expiresAt && (
          <View style={styles.expiryBadge}>
            <Ionicons name="time-outline" size={14} color={COLORS.warning} />
            <Text style={styles.expiryText}>
              {new Date(item.expiresAt) > new Date() ? 'نشط' : 'منتهي'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [isDarkMode, handleItemPress]);

  const styles = createStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'with-me' && styles.activeTab]}
          onPress={() => setActiveTab('with-me')}
        >
          <Text style={[styles.tabText, activeTab === 'with-me' && styles.activeTabText]}>
            مشترك معي
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'by-me' && styles.activeTab]}
          onPress={() => setActiveTab('by-me')}
        >
          <Text style={[styles.tabText, activeTab === 'by-me' && styles.activeTabText]}>
            شاركته
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (activeTab === 'with-me' ? sharedWithMe : sharedByMe).length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="share-social-outline" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>
            {activeTab === 'with-me' ? 'لا توجد ملفات مشتركة معك' : 'لم تشارك أي ملفات'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'with-me' 
              ? 'الملفات التي يشاركها الآخرون معك ستظهر هنا'
              : 'شارك ملفاتك مع الآخرين لتظهر هنا'
            }
          </Text>
        </View>
      ) : activeTab === 'with-me' ? (
        <FlatList
          data={sharedWithMe}
          renderItem={renderSharedWithMeItem}
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
      ) : (
        <FlatList
          data={sharedByMe}
          renderItem={renderSharedByMeItem}
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

const getPermissionColor = (permission: string) => {
  switch (permission) {
    case 'edit': return `${COLORS.success}20`;
    case 'download': return `${COLORS.primary}20`;
    default: return `${COLORS.secondary}20`;
  }
};

const getPermissionLabel = (permission: string) => {
  switch (permission) {
    case 'edit': return 'تعديل';
    case 'download': return 'تحميل';
    default: return 'عرض';
  }
};

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: COLORS.primary,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '500',
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    activeTabText: {
      color: COLORS.primary,
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
      textAlign: 'center',
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
    permissionBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    permissionText: {
      fontSize: 12,
      fontWeight: '500',
      color: COLORS.primary,
    },
    expiryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    expiryText: {
      fontSize: 12,
      color: COLORS.warning,
    },
  });
