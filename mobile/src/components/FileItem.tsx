import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { formatFileSize, formatRelativeTime } from '../utils/formatters';
import { getFileTypeInfo } from '../utils/fileTypes';
import type { File, Folder, FileOrFolder, ViewMode } from '../types';

interface FileItemProps {
  item: FileOrFolder;
  viewMode: ViewMode;
  isDarkMode: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function FileItem({
  item,
  viewMode,
  isDarkMode,
  isSelected = false,
  onPress,
  onLongPress,
}: FileItemProps) {
  const isFolder = item.type === 'folder';
  const fileInfo = isFolder ? null : getFileTypeInfo(item.name, (item as File).mimeType);
  
  const styles = createStyles(isDarkMode, viewMode, isSelected);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      {isSelected && (
        <View style={styles.selectedOverlay}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
        </View>
      )}
      
      <View style={[styles.iconContainer, { backgroundColor: isFolder ? '#f59e0b20' : `${fileInfo?.color}20` }]}>
        <Ionicons
          name={isFolder ? 'folder' : (fileInfo?.icon as any) || 'document'}
          size={viewMode === 'grid' ? 40 : 24}
          color={isFolder ? '#f59e0b' : fileInfo?.color || COLORS.secondary}
        />
      </View>
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={viewMode === 'grid' ? 2 : 1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          {isFolder 
            ? `${(item as Folder).itemCount || 0} عنصر`
            : `${formatFileSize((item as File).size)} • ${formatRelativeTime(item.updatedAt)}`
          }
        </Text>
      </View>
      
      {viewMode === 'list' && (
        <TouchableOpacity style={styles.moreButton} onPress={onLongPress}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      )}
      
      {/* Favorite indicator */}
      {!isFolder && (item as File).isFavorite && (
        <View style={styles.favoriteIndicator}>
          <Ionicons name="star" size={14} color={COLORS.warning} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (isDarkMode: boolean, viewMode: ViewMode, isSelected: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: viewMode === 'grid' ? 'column' : 'row',
      alignItems: 'center',
      padding: viewMode === 'grid' ? 16 : 12,
      margin: viewMode === 'grid' ? 8 : 0,
      backgroundColor: isSelected 
        ? `${COLORS.primary}15`
        : viewMode === 'grid' 
          ? (isDarkMode ? COLORS.surface.dark : COLORS.surface.light)
          : 'transparent',
      borderRadius: viewMode === 'grid' ? 12 : 0,
      borderBottomWidth: viewMode === 'list' ? 1 : 0,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
      flex: viewMode === 'grid' ? 1 : undefined,
      position: 'relative',
    },
    selectedOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1,
    },
    iconContainer: {
      width: viewMode === 'grid' ? 64 : 44,
      height: viewMode === 'grid' ? 64 : 44,
      borderRadius: viewMode === 'grid' ? 16 : 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: {
      flex: viewMode === 'list' ? 1 : undefined,
      marginLeft: viewMode === 'list' ? 12 : 0,
      marginTop: viewMode === 'grid' ? 12 : 0,
      alignItems: viewMode === 'grid' ? 'center' : 'flex-start',
    },
    name: {
      fontSize: 15,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      textAlign: viewMode === 'grid' ? 'center' : 'left',
    },
    meta: {
      fontSize: 12,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 2,
    },
    moreButton: {
      padding: 8,
    },
    favoriteIndicator: {
      position: 'absolute',
      top: viewMode === 'grid' ? 8 : 12,
      left: viewMode === 'grid' ? 8 : undefined,
      right: viewMode === 'list' ? 40 : undefined,
    },
  });

export default memo(FileItem);
