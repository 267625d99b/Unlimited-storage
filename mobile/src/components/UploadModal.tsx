import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../utils/constants';
import { uploadFile } from '../services/api';
import type { File } from '../types';

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentFolderId: string | null;
  isDarkMode?: boolean;
}

type UploadMode = 'select' | 'uploading' | 'folder';

export default function UploadModal({
  visible,
  onClose,
  onSuccess,
  currentFolderId,
  isDarkMode = false,
}: UploadModalProps) {
  const [mode, setMode] = useState<UploadMode>('select');
  const [folderName, setFolderName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const styles = createStyles(isDarkMode);

  const resetState = () => {
    setMode('select');
    setFolderName('');
    setUploadProgress(0);
    setUploadingFileName('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setMode('uploading');
      
      for (const asset of result.assets) {
        setUploadingFileName(asset.name);
        setUploadProgress(0);
        
        await uploadFile(
          asset.uri,
          asset.name,
          asset.mimeType || 'application/octet-stream',
          currentFolderId,
          (progress) => setUploadProgress(progress)
        );
      }

      handleClose();
      onSuccess();
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في رفع الملف');
      resetState();
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'نحتاج إذن الوصول للصور');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) return;

      setMode('uploading');

      for (const asset of result.assets) {
        const fileName = asset.fileName || `image_${Date.now()}.jpg`;
        setUploadingFileName(fileName);
        setUploadProgress(0);

        await uploadFile(
          asset.uri,
          fileName,
          asset.mimeType || 'image/jpeg',
          currentFolderId,
          (progress) => setUploadProgress(progress)
        );
      }

      handleClose();
      onSuccess();
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في رفع الصور');
      resetState();
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'نحتاج إذن الوصول للكاميرا');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
      });

      if (result.canceled) return;

      setMode('uploading');
      const asset = result.assets[0];
      const fileName = `photo_${Date.now()}.jpg`;
      setUploadingFileName(fileName);

      await uploadFile(
        asset.uri,
        fileName,
        'image/jpeg',
        currentFolderId,
        (progress) => setUploadProgress(progress)
      );

      handleClose();
      onSuccess();
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في رفع الصورة');
      resetState();
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المجلد');
      return;
    }

    setIsCreatingFolder(true);
    try {
      const { foldersApi } = await import('../services/api');
      await foldersApi.createFolder(folderName.trim(), currentFolderId);
      handleClose();
      onSuccess();
    } catch (error: any) {
      Alert.alert('خطأ', error.response?.data?.error || 'فشل في إنشاء المجلد');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const renderContent = () => {
    if (mode === 'uploading') {
      return (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.uploadingText}>جاري رفع الملف...</Text>
          <Text style={styles.fileName} numberOfLines={1}>{uploadingFileName}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
        </View>
      );
    }

    if (mode === 'folder') {
      return (
        <View style={styles.folderContainer}>
          <Text style={styles.folderTitle}>إنشاء مجلد جديد</Text>
          <TextInput
            style={styles.input}
            placeholder="اسم المجلد"
            placeholderTextColor={COLORS.secondary}
            value={folderName}
            onChangeText={setFolderName}
            autoFocus
          />
          <View style={styles.folderActions}>
            <TouchableOpacity
              style={styles.cancelFolderButton}
              onPress={() => setMode('select')}
            >
              <Text style={styles.cancelFolderText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createFolderButton, !folderName.trim() && styles.disabledButton]}
              onPress={handleCreateFolder}
              disabled={!folderName.trim() || isCreatingFolder}
            >
              {isCreatingFolder ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createFolderText}>إنشاء</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.option} onPress={handlePickDocument}>
          <View style={[styles.iconContainer, { backgroundColor: `${COLORS.primary}20` }]}>
            <Ionicons name="document" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>ملف</Text>
            <Text style={styles.optionSubtitle}>اختر ملف من الجهاز</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={handlePickImage}>
          <View style={[styles.iconContainer, { backgroundColor: `${COLORS.success}20` }]}>
            <Ionicons name="images" size={28} color={COLORS.success} />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>صور وفيديو</Text>
            <Text style={styles.optionSubtitle}>اختر من المعرض</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
          <View style={[styles.iconContainer, { backgroundColor: `${COLORS.warning}20` }]}>
            <Ionicons name="camera" size={28} color={COLORS.warning} />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>التقاط صورة</Text>
            <Text style={styles.optionSubtitle}>استخدم الكاميرا</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => setMode('folder')}>
          <View style={[styles.iconContainer, { backgroundColor: `#f59e0b20` }]}>
            <Ionicons name="folder-open" size={28} color="#f59e0b" />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>مجلد جديد</Text>
            <Text style={styles.optionSubtitle}>إنشاء مجلد</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'folder' ? 'مجلد جديد' : mode === 'uploading' ? 'جاري الرفع' : 'إضافة'}
            </Text>
            {mode === 'select' && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            )}
          </View>
          
          {renderContent()}
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
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      padding: 4,
    },
    optionsContainer: {
      padding: 16,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 8,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      borderRadius: 12,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionInfo: {
      marginLeft: 14,
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    optionSubtitle: {
      fontSize: 13,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 2,
    },
    uploadingContainer: {
      padding: 32,
      alignItems: 'center',
    },
    uploadingText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
      marginTop: 16,
    },
    fileName: {
      fontSize: 14,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      marginTop: 8,
      maxWidth: '80%',
    },
    progressBar: {
      width: '100%',
      height: 6,
      backgroundColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
      borderRadius: 3,
      marginTop: 20,
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
      marginTop: 8,
    },
    folderContainer: {
      padding: 20,
    },
    folderTitle: {
      fontSize: 16,
      fontWeight: '500',
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
    folderActions: {
      flexDirection: 'row',
      marginTop: 20,
      gap: 12,
    },
    cancelFolderButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      alignItems: 'center',
    },
    cancelFolderText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    createFolderButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
    },
    createFolderText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
