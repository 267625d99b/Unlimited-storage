import { create } from 'zustand';
import { filesApi, foldersApi } from '../services/api';
import { appStorage } from '../services/storage';
import type { File, Folder, FileOrFolder, ViewMode, SortOption, SortOrder } from '../types';

interface FilesState {
  files: FileOrFolder[];
  currentFolder: Folder | null;
  breadcrumbs: Folder[];
  viewMode: ViewMode;
  sortBy: SortOption;
  sortOrder: SortOrder;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  selectedItems: string[];
  searchQuery: string;
  searchResults: FileOrFolder[];
}

interface FilesActions {
  fetchFiles: (folderId?: string | null) => Promise<void>;
  refreshFiles: () => Promise<void>;
  navigateToFolder: (folder: Folder) => Promise<void>;
  navigateBack: () => Promise<void>;
  navigateToRoot: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortOption) => void;
  setSortOrder: (order: SortOrder) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  deleteSelected: () => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  createFolder: (name: string) => Promise<Folder>;
  deleteItem: (id: string, isFolder: boolean) => Promise<void>;
  renameItem: (id: string, name: string, isFolder: boolean) => Promise<void>;
}

type FilesStore = FilesState & FilesActions;

const sortFiles = (files: FileOrFolder[], sortBy: SortOption, sortOrder: SortOrder): FileOrFolder[] => {
  const sorted = [...files].sort((a, b) => {
    // Folders always come first
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'ar');
        break;
      case 'date':
        comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        break;
      case 'size':
        const sizeA = a.type === 'file' ? (a as File).size : 0;
        const sizeB = b.type === 'file' ? (b as File).size : 0;
        comparison = sizeB - sizeA;
        break;
      case 'type':
        if (a.type === 'file' && b.type === 'file') {
          comparison = (a as File).mimeType.localeCompare((b as File).mimeType);
        }
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
};

export const useFilesStore = create<FilesStore>((set, get) => ({
  // State
  files: [],
  currentFolder: null,
  breadcrumbs: [],
  viewMode: (appStorage.get('viewMode') as ViewMode) || 'list',
  sortBy: (appStorage.get('sortBy') as SortOption) || 'name',
  sortOrder: (appStorage.get('sortOrder') as SortOrder) || 'asc',
  isLoading: false,
  isRefreshing: false,
  error: null,
  selectedItems: [],
  searchQuery: '',
  searchResults: [],

  // Actions
  fetchFiles: async (folderId?: string | null) => {
    const { sortBy, sortOrder } = get();
    set({ isLoading: true, error: null });
    
    try {
      const files = await filesApi.getFiles(folderId);
      const sortedFiles = sortFiles(files, sortBy, sortOrder);
      
      let currentFolder: Folder | null = null;
      let breadcrumbs: Folder[] = [];
      
      if (folderId) {
        currentFolder = await foldersApi.getFolder(folderId);
        breadcrumbs = await foldersApi.getBreadcrumbs(folderId);
      }
      
      set({
        files: sortedFiles,
        currentFolder,
        breadcrumbs,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'فشل تحميل الملفات',
        isLoading: false,
      });
    }
  },

  refreshFiles: async () => {
    const { currentFolder, sortBy, sortOrder } = get();
    set({ isRefreshing: true });
    
    try {
      const files = await filesApi.getFiles(currentFolder?.id);
      const sortedFiles = sortFiles(files, sortBy, sortOrder);
      set({ files: sortedFiles, isRefreshing: false });
    } catch {
      set({ isRefreshing: false });
    }
  },

  navigateToFolder: async (folder: Folder) => {
    await get().fetchFiles(folder.id);
  },

  navigateBack: async () => {
    const { breadcrumbs } = get();
    if (breadcrumbs.length > 1) {
      const parentFolder = breadcrumbs[breadcrumbs.length - 2];
      await get().fetchFiles(parentFolder.id);
    } else {
      await get().fetchFiles(null);
    }
  },

  navigateToRoot: async () => {
    await get().fetchFiles(null);
  },

  setViewMode: (mode: ViewMode) => {
    appStorage.set('viewMode', mode);
    set({ viewMode: mode });
  },

  setSortBy: (sort: SortOption) => {
    const { files, sortOrder } = get();
    appStorage.set('sortBy', sort);
    const sortedFiles = sortFiles(files, sort, sortOrder);
    set({ sortBy: sort, files: sortedFiles });
  },

  setSortOrder: (order: SortOrder) => {
    const { files, sortBy } = get();
    appStorage.set('sortOrder', order);
    const sortedFiles = sortFiles(files, sortBy, order);
    set({ sortOrder: order, files: sortedFiles });
  },

  selectItem: (id: string) => {
    set((state) => ({
      selectedItems: [...state.selectedItems, id],
    }));
  },

  deselectItem: (id: string) => {
    set((state) => ({
      selectedItems: state.selectedItems.filter((item) => item !== id),
    }));
  },

  clearSelection: () => {
    set({ selectedItems: [] });
  },

  selectAll: () => {
    const { files } = get();
    set({ selectedItems: files.map((f) => f.id) });
  },

  deleteSelected: async () => {
    const { selectedItems, files, refreshFiles } = get();
    
    for (const id of selectedItems) {
      const item = files.find((f) => f.id === id);
      if (item) {
        if (item.type === 'folder') {
          await foldersApi.deleteFolder(id);
        } else {
          await filesApi.deleteFile(id);
        }
      }
    }
    
    set({ selectedItems: [] });
    await refreshFiles();
  },

  search: async (query: string) => {
    set({ searchQuery: query, isLoading: true });
    
    if (!query.trim()) {
      set({ searchResults: [], isLoading: false });
      return;
    }
    
    try {
      const results = await filesApi.search(query);
      set({ searchResults: results, isLoading: false });
    } catch {
      set({ searchResults: [], isLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: '', searchResults: [] });
  },

  createFolder: async (name: string) => {
    const { currentFolder, refreshFiles } = get();
    const folder = await foldersApi.createFolder(name, currentFolder?.id);
    await refreshFiles();
    return folder;
  },

  deleteItem: async (id: string, isFolder: boolean) => {
    const { refreshFiles } = get();
    if (isFolder) {
      await foldersApi.deleteFolder(id);
    } else {
      await filesApi.deleteFile(id);
    }
    await refreshFiles();
  },

  renameItem: async (id: string, name: string, isFolder: boolean) => {
    const { refreshFiles } = get();
    if (isFolder) {
      await foldersApi.renameFolder(id, name);
    } else {
      await filesApi.renameFile(id, name);
    }
    await refreshFiles();
  },
}));
