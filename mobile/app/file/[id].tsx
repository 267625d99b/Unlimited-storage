import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { filesApi, getDownloadUrl, getThumbnailUrl } from '../../src/services/api';
import { COLORS } from '../../src/utils/constants';
import { formatFileSize, formatRelativeTime } from '../../src/utils/formatters';
import { getFileTypeInfo } from '../../src/utils/fileTypes';
import type { File } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode } = useSettingsStore();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFile();
  }, [id]);

  const loadFile = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fileData = await filesApi.getFile(id);
      setFile(fileData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'فشل في تحميل الملف');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!file) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const downloadUrl = getDownloadUrl(file.id);
      const fileUri = FileSystem.cacheDirectory + file.name;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );
      
      const result = await downloadResumable.downloadAsync();
      
      if (result?.uri) {
        Alert.alert('تم التحميل', 'تم حفظ الملف بنجاح');
      }
    } catch (err: any) {
      Alert.alert('خطأ', 'فشل في تحميل الملف');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [file]);

  const handleShare = useCallback(async () => {
    if (!file) return;
    
    try {
      await Share.share({
        message: `شارك الملف: ${file.name}`,
        url: getDownloadUrl(file.id),
      });
    } catch (err) {
      // User cancelled
    }
  }, [file]);

  const handleDelete = useCallback(() => {
    if (!file) return;
    
    Alert.alert(
      'حذف الملف',
      `هل أنت متأكد من حذف "${file.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await filesApi.deleteFile(file.id);
              router.back();
            } catch (err) {
              Alert.alert('خطأ', 'فشل في حذف الملف');
            }
          },
        },
      ]
    );
  }, [file]);

  const handleToggleFavorite = useCallback(async () => {
    if (!file) return;
    
    try {
      const updatedFile = await filesApi.toggleFavorite(file.id);
      setFile(updatedFile);
    } catch (err) {
      Alert.alert('خطأ', 'فشل في تحديث المفضلة');
    }
  }, [file]);

  const renderPreview = () => {
    if (!file) return null;
    
    const fileInfo = getFileTypeInfo(file.name, file.mimeType);
    
    // Image preview
    if (file.mimeType.startsWith('image/')) {
      return (
        <Image
          source={{ uri: getDownloadUrl(file.id) }}
          style={styles.imagePreview}
          contentFit="contain"
          transition={300}
        />
      );
    }
    
    // Video preview - show icon for now
    if (file.mimeType.startsWith('video/')) {
      return (
        <View style={[styles.iconPreview, { backgroundColor: '#ef444420' }]}>
          <Ionicons name="videocam" size={80} color="#ef4444" />
          <Text style={[styles.fileExtension, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]}>
            فيديو
          </Text>
        </View>
      );
    }
    
    // Default icon preview
    return (
      <View style={[styles.iconPreview, { backgroundColor: `${fileInfo?.color}20` }]}>
        <Ionicons
          name={(fileInfo?.icon as any) || 'document'}
          size={80}
          color={fileInfo?.color || COLORS.secondary}
        />
        <Text style={[styles.fileExtension, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]}>
          {file.name.split('.').pop()?.toUpperCase()}
        </Text>
      </View>
    );
  };

  const styles = createStyles(isDarkMode);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !file) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'الملف غير موجود'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadFile}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fileInfo = getFileTypeInfo(file.name, file.mimeType);

  return (
    <>
      <Stack.Screen
        options={{
          title: file.name,
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleFavorite} style={{ marginRight: 8 }}>
              <Ionicons
                name={file.isFavorite ? 'star' : 'star-outline'}
                size={24}
                color={file.isFavorite ? COLORS.warning : COLORS.secondary}
              />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.container}>
        {/* Preview */}
        <View style={styles.previewContainer}>
          {renderPreview()}
        </View>

        {/* File Info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الاسم</Text>
            <Text style={styles.infoValue}>{file.name}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الحجم</Text>
            <Text style={styles.infoValue}>{formatFileSize(file.size)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>النوع</Text>
            <Text style={styles.infoValue}>{fileInfo?.label || file.mimeType}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>تاريخ الإنشاء</Text>
            <Text style={styles.infoValue}>{formatRelativeTime(file.createdAt)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>آخر تعديل</Text>
            <Text style={styles.infoValue}>{formatRelativeTime(file.updatedAt)}</Text>
          </View>
        </View>

        {/* Download Progress */}
        {isDownloading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            <Ionicons name="download" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {isDownloading ? 'جاري التحميل...' : 'تحميل'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>مشاركة</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.secondaryButton, styles.deleteButton]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.error }]}>حذف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
    },
    errorText: {
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginTop: 16,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: COLORS.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    previewContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 0.75,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    videoPreview: {
      width: '100%',
      height: '100%',
    },
    iconPreview: {
      width: 160,
      height: 160,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileExtension: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
    },
    infoContainer: {
      padding: 16,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    infoLabel: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      maxWidth: '60%',
      textAlign: 'right',
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
      borderRadius: 3,
      marginRight: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: 3,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.primary,
      width: 45,
    },
    actionsContainer: {
      padding: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    primaryButton: {
      backgroundColor: COLORS.primary,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryActions: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      gap: 6,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: COLORS.primary,
    },
    deleteButton: {
      backgroundColor: `${COLORS.error}10`,
    },
  });
