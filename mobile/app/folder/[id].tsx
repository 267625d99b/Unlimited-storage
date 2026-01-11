import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useFilesStore } from '../../src/stores/filesStore';
import { COLORS } from '../../src/utils/constants';
import FileItem from '../../src/components/FileItem';
import EmptyState from '../../src/components/EmptyState';
import ActionSheet, { ActionSheetOption } from '../../src/components/ActionSheet';
import { FileOrFolder } from '../../src/types';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { isDarkMode } = useSettingsStore();
  const { files, isLoading, fetchFiles, deleteItem } = useFilesStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileOrFolder | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const backgroundColor = isDarkMode ? COLORS.background.dark : COLORS.background.light;

  useEffect(() => {
    if (id) {
      fetchFiles(id);
      navigation.setOptions({ title: 'مجلد' });
    }
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFiles(id);
    setRefreshing(false);
  };

  const handleFilePress = (file: FileOrFolder) => {
    if (file.type === 'folder') {
      router.push(`/folder/${file.id}`);
    } else {
      router.push(`/file/${file.id}`);
    }
  };

  const handleFileLongPress = (file: FileOrFolder) => {
    setSelectedFile(file);
    setShowActionSheet(true);
  };

  const getActionSheetOptions = (): ActionSheetOption[] => {
    if (!selectedFile) return [];
    
    const options: ActionSheetOption[] = [
      {
        label: 'فتح',
        icon: 'open-outline',
        onPress: () => handleFilePress(selectedFile),
      },
    ];

    options.push({
      label: 'حذف',
      icon: 'trash-outline',
      onPress: () => deleteItem(selectedFile.id, selectedFile.type === 'folder'),
      destructive: true,
    });

    return options;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileItem
            item={item}
            viewMode="list"
            isDarkMode={isDarkMode}
            onPress={() => handleFilePress(item)}
            onLongPress={() => handleFileLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="المجلد فارغ"
            subtitle="لا توجد ملفات في هذا المجلد"
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={files.length === 0 ? styles.emptyList : undefined}
      />

      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title={selectedFile?.name}
        options={getActionSheetOptions()}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    flex: 1,
  },
});
