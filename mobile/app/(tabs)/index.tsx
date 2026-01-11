import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFilesStore } from '../../src/stores/filesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS } from '../../src/utils/constants';
import { formatFileSize, formatRelativeTime } from '../../src/utils/formatters';
import { getFileTypeInfo } from '../../src/utils/fileTypes';
import ActionSheet, { ActionSheetOption } from '../../src/components/ActionSheet';
import UploadModal from '../../src/components/UploadModal';
import RenameModal from '../../src/components/RenameModal';
import type { FileOrFolder, File, Folder } from '../../src/types';

export default function FilesScreen() {
  const {
    files,
    currentFolder,
    breadcrumbs,
    viewMode,
    isLoading,
    isRefreshing,
    fetchFiles,
    refreshFiles,
    navigateToFolder,
    setViewMode,
    deleteItem,
    renameItem,
  } = useFilesStore();
  
  const { isDarkMode } = useSettingsStore();
  
  // Local state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileOrFolder | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);

  useEffect(() => {
    fetchFiles(null);
  }, []);

  const handleItemPress = useCallback((item: FileOrFolder) => {
    if (item.type === 'folder') {
      navigateToFolder(item as Folder);
    } else {
      router.push(`/file/${item.id}`);
    }
  }, [navigateToFolder]);

  const handleItemLongPress = useCallback((item: FileOrFolder) => {
    setSelectedItem(item);
    setShowActionSheet(true);
  }, []);

  const handleRename = useCallback(() => {
    if (!selectedItem) return;
    setShowRenameModal(true);
  }, [selectedItem]);

  const handleRenameSubmit = useCallback(async (newName: string) => {
    if (!selectedItem) return;
    await renameItem(selectedItem.id, newName, selectedItem.type === 'folder');
  }, [selectedItem, renameItem]);

  const handleDelete = useCallback(() => {
    if (!selectedItem) return;
    
    Alert.alert(
      'حذف',
      `هل أنت متأكد من حذف "${selectedItem.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(selectedItem.id, selectedItem.type === 'folder');
            } catch (err) {
              Alert.alert('خطأ', 'فشل في الحذف');
            }
          },
        },
      ]
    );
  }, [selectedItem, deleteItem]);

  const getActionSheetOptions = useCallback((): ActionSheetOption[] => {
    if (!selectedItem) return [];
    
    const isFolder = selectedItem.type === 'folder';
    
    const options: ActionSheetOption[] = [
      {
        label: 'فتح',
        icon: isFolder ? 'folder-open' : 'open',
        onPress: () => handleItemPress(selectedItem),
      },
      {
        label: 'إعادة التسمية',
        icon: 'pencil',
        onPress: handleRename,
      },
    ];
    
    if (!isFolder) {
      options.push({
        label: 'تحميل',
        icon: 'download',
        onPress: () => router.push(`/file/${selectedItem.id}`),
      });
      options.push({
        label: 'مشاركة',
        icon: 'share-outline',
        onPress: () => {
          // TODO: Implement share
          Alert.alert('قريباً', 'ميزة المشاركة قيد التطوير');
        },
      });
    }
    
    options.push({
      label: 'حذف',
      icon: 'trash',
      onPress: handleDelete,
      destructive: true,
    });
    
    return options;
  }, [selectedItem, handleItemPress, handleRename, handleDelete]);

  const renderItem = useCallback(({ item }: { item: FileOrFolder }) => {
    const isFolder = item.type === 'folder';
    const fileInfo = isFolder ? null : getFileTypeInfo(item.name, (item as File).mimeType);
    
    return (
      <TouchableOpacity
        style={[styles.item, viewMode === 'grid' && styles.gridItem]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleItemLongPress(item)}
        activeOpacity={0.7}
        delayLongPress={300}
      >
        <View style={[styles.iconContainer, { backgroundColor: isFolder ? '#f59e0b20' : `${fileInfo?.color}20` }]}>
          <Ionicons
            name={isFolder ? 'folder' : (fileInfo?.icon as any) || 'document'}
            size={viewMode === 'grid' ? 40 : 24}
            color={isFolder ? '#f59e0b' : fileInfo?.color || COLORS.secondary}
          />
        </View>
        
        <View style={styles.itemInfo}>
          <Text 
            style={[styles.itemName, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]}
            numberOfLines={viewMode === 'grid' ? 2 : 1}
          >
            {item.name}
          </Text>
          <Text style={[styles.itemMeta, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            {isFolder 
              ? `${(item as Folder).itemCount || 0} عنصر`
              : `${formatFileSize((item as File).size)} • ${formatRelativeTime(item.updatedAt)}`
            }
          </Text>
        </View>
        
        {viewMode === 'list' && (
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => handleItemLongPress(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        )}
        
        {/* Favorite indicator */}
        {!isFolder && (item as File).isFavorite && (
          <View style={[styles.favoriteIndicator, viewMode === 'grid' && styles.favoriteIndicatorGrid]}>
            <Ionicons name="star" size={14} color={COLORS.warning} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [viewMode, isDarkMode, handleItemPress, handleItemLongPress]);

  const styles = createStyles(isDarkMode, viewMode);

  return (
    <View style={styles.container}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <View style={styles.breadcrumbs}>
          <TouchableOpacity onPress={() => fetchFiles(null)} style={styles.breadcrumbItem}>
            <Ionicons name="home" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          {breadcrumbs.map((folder, index) => (
            <View key={folder.id} style={styles.breadcrumbItem}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
              <TouchableOpacity onPress={() => fetchFiles(folder.id)}>
                <Text style={styles.breadcrumbText}>{folder.name}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.itemCount}>
          {files.length} عنصر
        </Text>
        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          <Ionicons
            name={viewMode === 'list' ? 'grid' : 'list'}
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Files List */}
      {isLoading && files.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyText}>لا توجد ملفات</Text>
          <Text style={styles.emptySubtext}>اضغط + لرفع ملفاتك</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshFiles}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowUploadModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Upload Modal */}
      <UploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={refreshFiles}
        currentFolderId={currentFolder?.id || null}
        isDarkMode={isDarkMode}
      />

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionSheet}
        onClose={() => {
          setShowActionSheet(false);
          setSelectedItem(null);
        }}
        title={selectedItem?.name}
        options={getActionSheetOptions()}
        isDarkMode={isDarkMode}
      />

      {/* Rename Modal */}
      <RenameModal
        visible={showRenameModal}
        currentName={selectedItem?.name || ''}
        onClose={() => {
          setShowRenameModal(false);
          setSelectedItem(null);
        }}
        onRename={handleRenameSubmit}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}


const createStyles = (isDarkMode: boolean, viewMode: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    breadcrumbs: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    breadcrumbItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    breadcrumbText: {
      color: COLORS.primary,
      marginLeft: 4,
      fontSize: 14,
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    itemCount: {
      fontSize: 13,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    viewModeButton: {
      padding: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 8,
    },
    listContent: {
      padding: viewMode === 'grid' ? 8 : 0,
      paddingBottom: 100,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
      position: 'relative',
    },
    gridItem: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      margin: 8,
      padding: 16,
      borderRadius: 12,
      borderBottomWidth: 0,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
    },
    iconContainer: {
      width: viewMode === 'grid' ? 64 : 44,
      height: viewMode === 'grid' ? 64 : 44,
      borderRadius: viewMode === 'grid' ? 16 : 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: viewMode === 'list' ? 1 : undefined,
      marginLeft: viewMode === 'grid' ? 0 : 12,
      marginTop: viewMode === 'grid' ? 12 : 0,
      alignItems: viewMode === 'grid' ? 'center' : 'flex-start',
    },
    itemName: {
      fontSize: 15,
      fontWeight: '500',
      textAlign: viewMode === 'grid' ? 'center' : 'left',
    },
    itemMeta: {
      fontSize: 12,
      marginTop: 2,
    },
    moreButton: {
      padding: 8,
    },
    favoriteIndicator: {
      position: 'absolute',
      right: 40,
      top: 12,
    },
    favoriteIndicatorGrid: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: undefined,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
  });
