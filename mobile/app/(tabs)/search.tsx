import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useFilesStore } from '../../src/stores/filesStore';
import { filesApi } from '../../src/services/api';
import { COLORS, UI_CONFIG } from '../../src/utils/constants';
import { formatFileSize, formatRelativeTime } from '../../src/utils/formatters';
import { getFileTypeInfo } from '../../src/utils/fileTypes';
import type { FileOrFolder, File, Folder } from '../../src/types';

export default function SearchScreen() {
  const { isDarkMode } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileOrFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, UI_CONFIG.DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await filesApi.search(searchQuery);
      setResults(searchResults);
      
      // Save to recent searches
      setRecentSearches(prev => {
        const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 5);
        return updated;
      });
    } catch (error) {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemPress = useCallback((item: FileOrFolder) => {
    Keyboard.dismiss();
    if (item.type === 'folder') {
      // Navigate to folder in files tab
      router.push('/(tabs)');
    } else {
      router.push(`/file/${item.id}`);
    }
  }, []);

  const handleRecentSearch = (searchTerm: string) => {
    setQuery(searchTerm);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const renderItem = useCallback(({ item }: { item: FileOrFolder }) => {
    const isFolder = item.type === 'folder';
    const fileInfo = isFolder ? null : getFileTypeInfo(item.name, (item as File).mimeType);

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: isFolder ? '#f59e0b20' : `${fileInfo?.color}20` }]}>
          <Ionicons
            name={isFolder ? 'folder' : (fileInfo?.icon as any) || 'document'}
            size={24}
            color={isFolder ? '#f59e0b' : fileInfo?.color || COLORS.secondary}
          />
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: isDarkMode ? COLORS.text.dark : COLORS.text.light }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemMeta, { color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light }]}>
            {isFolder 
              ? `مجلد • ${(item as Folder).itemCount || 0} عنصر`
              : `${formatFileSize((item as File).size)} • ${formatRelativeTime(item.updatedAt)}`
            }
          </Text>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
      </TouchableOpacity>
    );
  }, [isDarkMode, handleItemPress]);

  const styles = createStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث في ملفاتك..."
            placeholderTextColor={COLORS.secondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
          <Text style={styles.emptySubtitle}>جرب كلمات بحث مختلفة</Text>
        </View>
      ) : !hasSearched && query.length === 0 ? (
        <View style={styles.suggestionsContainer}>
          {recentSearches.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>عمليات البحث الأخيرة</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearText}>مسح</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentItem}
                  onPress={() => handleRecentSearch(search)}
                >
                  <Ionicons name="time-outline" size={20} color={COLORS.secondary} />
                  <Text style={styles.recentText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>اقتراحات</Text>
          </View>
          <View style={styles.suggestionsGrid}>
            {['صور', 'فيديو', 'PDF', 'مستندات'].map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => setQuery(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} نتيجة
            </Text>
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
    searchContainer: {
      padding: 16,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.border.dark : COLORS.border.light,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? COLORS.background.dark : COLORS.background.light,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
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
    },
    suggestionsContainer: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      textTransform: 'uppercase',
    },
    clearText: {
      fontSize: 14,
      color: COLORS.primary,
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    recentText: {
      fontSize: 15,
      color: isDarkMode ? COLORS.text.dark : COLORS.text.light,
    },
    suggestionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: isDarkMode ? COLORS.surface.dark : COLORS.surface.light,
      borderRadius: 20,
    },
    suggestionText: {
      fontSize: 14,
      color: COLORS.primary,
    },
    listContent: {
      paddingBottom: 20,
    },
    resultsCount: {
      fontSize: 13,
      color: isDarkMode ? COLORS.textSecondary.dark : COLORS.textSecondary.light,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    resultItem: {
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
  });
