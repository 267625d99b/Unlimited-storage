import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import {
  FiFolder, FiUpload, FiSearch, FiGrid, FiList, FiX, FiChevronLeft,
  FiHardDrive, FiStar, FiClock, FiTrash2, FiRefreshCw, FiCopy, FiTag,
  FiPackage, FiArrowUp, FiArrowDown, FiFile, FiUser, FiKey, FiLogOut, FiSettings,
  FiCpu
} from 'react-icons/fi';
import './App.css';

// Components
import Toast from './components/Toast';
import { FolderItem, FileItemComponent } from './components/FileItem';
import ContextMenu from './components/ContextMenu';
import { NewFolderModal, MoveModal, ShareModal, FileInfoModal, RenameModal } from './components/Modals';
import AuthPage from './components/AuthPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import AdvancedSearch from './components/AdvancedSearch';
import SettingsModal from './components/SettingsModal';
import DuplicatesModal from './components/DuplicatesModal';
import StorageAnalyticsModal from './components/StorageAnalyticsModal';
import TagsManager from './components/TagsManager';
import TitleBar from './components/TitleBar';

// Lazy loaded new components (Sprint 4-10)
const VersionHistoryModal = lazy(() => import('./components/VersionHistoryModal'));
const CommentsPanel = lazy(() => import('./components/CommentsPanel'));
const CollectionsManager = lazy(() => import('./components/CollectionsManager'));
const AIPanel = lazy(() => import('./components/AIPanel'));
const SmartAssistant = lazy(() => import('./components/SmartAssistant'));

// Hooks
import { useThumbnailQueue } from './hooks/useThumbnailQueue';
import { useDebounce } from './hooks/useDebounce';

// Utils
import { formatSize, formatDate, getErrorMessage } from './utils/helpers';

// Lazy loaded components
const FilePreview = lazy(() => import('./components/FilePreview'));

const API = '/api';

// Set token from localStorage on app start
const savedToken = localStorage.getItem('access_token');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Setup axios interceptor for token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Skip refresh for auth endpoints to prevent loops
    const isAuthEndpoint = originalRequest.url?.includes('/users/login') ||
      originalRequest.url?.includes('/users/register') ||
      originalRequest.url?.includes('/users/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API}/users/refresh`, { refreshToken });
          const { accessToken } = res.data;

          localStorage.setItem('access_token', accessToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear tokens (don't reload to prevent loop)
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          delete axios.defaults.headers.common['Authorization'];
        }
      } else {
        // No refresh token - clear tokens (don't reload to prevent loop)
        localStorage.removeItem('access_token');
        delete axios.defaults.headers.common['Authorization'];
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userStorage, setUserStorage] = useState({ used: 0, limit: -1, unlimited: true });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showStorageAnalytics, setShowStorageAnalytics] = useState(false);
  const [showTagsManager, setShowTagsManager] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchResults, setSearchResults] = useState(null); // { files, folders, query, filters }

  // New states for Sprint 4-10 features
  const [showVersionHistory, setShowVersionHistory] = useState(null); // file object
  const [showComments, setShowComments] = useState(null); // file object
  const [showCollections, setShowCollections] = useState(false);
  const [addToCollectionFile, setAddToCollectionFile] = useState(null); // file to add to collection
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSelectedFile, setAiSelectedFile] = useState(null);
  const [showSmartAssistant, setShowSmartAssistant] = useState(false);

  // State
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [selectedItems, setSelectedItems] = useState([]);
  const [toast, setToast] = useState(null);
  const [preview, setPreview] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const [moveModal, setMoveModal] = useState(null);
  const [allFolders, setAllFolders] = useState([]);
  const [currentView, setCurrentView] = useState('files');
  const [trashItems, setTrashItems] = useState([]);
  const [shareModal, setShareModal] = useState(null);
  const [fileInfoModal, setFileInfoModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null); // { item, type }
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasMore: false, total: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Hooks
  const { loadThumbnailsForFiles } = useThumbnailQueue(setThumbnails);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoized values
  const selectedFileIds = useMemo(() =>
    selectedItems.filter(i => i.startsWith('file-')).map(i => i.replace('file-', '')),
    [selectedItems]
  );

  // Callbacks
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const loadFiles = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const params = {
        page,
        limit: 50,
        sortBy: sortBy === 'date' ? 'created_at' : sortBy,
        sortOrder: sortOrder.toUpperCase()
      };
      if (currentFolder) params.folderId = currentFolder;

      const res = await axios.get(`${API}/files`, { params });

      if (append) {
        setFiles(prev => [...prev, ...(res.data.files || [])]);
      } else {
        setFiles(res.data.files || []);
        setFolders(res.data.folders || []);
      }

      setPagination(res.data.pagination || { page: 1, totalPages: 1, hasMore: false, total: 0 });
      loadThumbnailsForFiles(res.data.files || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في تحميل الملفات'), 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentFolder, sortBy, sortOrder, loadThumbnailsForFiles, showToast]);

  const loadMoreFiles = useCallback(() => {
    if (pagination.hasMore && !loadingMore) {
      loadFiles(pagination.page + 1, true);
    }
  }, [pagination, loadingMore, loadFiles]);

  const loadStorage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/storage`);
      setStorageUsed(res.data.used);
    } catch (err) {
      // Silent fail for storage
    }
  }, []);

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedColor = localStorage.getItem('colorScheme') || 'blue';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-color', savedColor);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAuthenticated) return;

      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Ctrl + U: Upload
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        document.querySelector('input[type="file"]')?.click();
      }
      // Ctrl + N: New folder
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowNewFolder(true);
      }
      // Ctrl + F: Search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowAdvancedSearch(true);
      }
      // Delete: Delete selected
      if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        // Handle delete
      }
      // Ctrl + A: Select all
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        const allItems = [
          ...folders.map(f => `folder-${f.id}`),
          ...files.map(f => `file-${f.id}`)
        ];
        setSelectedItems(allItems);
      }
      // Escape: Clear selection
      if (e.key === 'Escape') {
        setSelectedItems([]);
        setShowAdvancedSearch(false);
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, selectedItems, folders, files]);

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const res = await axios.get(`${API}/users/me`);

        if (res.data.user) {
          setCurrentUser(res.data.user);
          setUserStorage(res.data.storage || { used: 0, limit: -1, unlimited: true });
          setIsAuthenticated(true);
        }
      } catch (err) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        delete axios.defaults.headers.common['Authorization'];
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuth();
  }, []);

  // Handle login
  const handleLogin = useCallback((user, token) => {
    // Ensure token is set
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Load user storage info
    axios.get(`${API}/users/storage`).then(res => {
      setUserStorage(res.data);
    }).catch(() => { });
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await axios.post(`${API}/users/logout`);
    } catch (err) {
      // Silent fail for logout
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowUserMenu(false);
  }, []);

  // Handle advanced search results
  const handleAdvancedSearch = useCallback((results) => {
    setSearchResults(results);
    setFiles(results.files);
    setFolders(results.folders);
    setShowAdvancedSearch(false);
    setCurrentView('search');
  }, []);

  // Clear search results
  const clearSearchResults = useCallback(() => {
    setSearchResults(null);
    setSearchQuery('');
    setCurrentView('files');
    loadFiles(1, false);
  }, [loadFiles]);

  // Effects - Load files when authenticated
  useEffect(() => {
    if (isAuthenticated && axios.defaults.headers.common['Authorization']) {
      loadFiles(1, false);
      loadStorage();
    }
  }, [currentFolder, sortBy, sortOrder, isAuthenticated, loadFiles, loadStorage]);

  useEffect(() => {
    setPagination({ page: 1, totalPages: 1, hasMore: false, total: 0 });
  }, [currentFolder]);

  // Search effect
  useEffect(() => {
    if (!isAuthenticated) return; // Don't search if not authenticated

    if (debouncedSearchQuery.trim()) {
      const search = async () => {
        try {
          const res = await axios.get(`${API}/search`, { params: { q: debouncedSearchQuery } });
          setFiles(res.data.files || []);
          setFolders(res.data.folders || []);
        } catch (err) {
          showToast('فشل في البحث', 'error');
        }
      };
      search();
    } else if (debouncedSearchQuery === '' && currentView === 'files') {
      loadFiles(1, false);
    }
  }, [debouncedSearchQuery]);


  // File operations - Parallel upload with concurrency limit
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const CONCURRENT_UPLOADS = 3; // رفع 3 ملفات بنفس الوقت
    let successCount = 0;
    let completedCount = 0;
    const totalFiles = acceptedFiles.length;
    const progressMap = {};

    // دالة لتحديث التقدم الكلي
    const updateTotalProgress = () => {
      const totalProgress = Math.round((completedCount / totalFiles) * 100);
      setUploadProgress(totalProgress);
    };

    // دالة رفع ملف واحد
    const uploadFile = async (file, index) => {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolder) formData.append('folderId', currentFolder);

      try {
        await axios.post(`${API}/upload`, formData, {
          onUploadProgress: (e) => {
            progressMap[index] = Math.round((e.loaded * 100) / e.total);
          }
        });
        successCount++;
      } catch (err) {
        // Silent fail for individual files
      }
      completedCount++;
      updateTotalProgress();
    };

    // رفع الملفات بشكل متوازي مع حد أقصى
    const uploadQueue = [...acceptedFiles];
    const workers = [];

    for (let i = 0; i < CONCURRENT_UPLOADS; i++) {
      workers.push((async () => {
        while (uploadQueue.length > 0) {
          const file = uploadQueue.shift();
          if (file) {
            const index = acceptedFiles.indexOf(file);
            await uploadFile(file, index);
          }
        }
      })());
    }

    await Promise.all(workers);

    setUploading(false);
    const failedCount = totalFiles - successCount;
    if (successCount > 0) {
      showToast(`تم رفع ${successCount} ملف بنجاح${failedCount > 0 ? ` (${failedCount} فشل)` : ''}`, successCount === totalFiles ? 'success' : 'warning');
    } else {
      showToast('فشل في رفع جميع الملفات', 'error');
    }
    loadFiles(1, false);
    loadStorage();
  }, [currentFolder, loadFiles, loadStorage, showToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    useFsAccessApi: false
  });

  const handleFolderUpload = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const folderStructure = {};

    filesArray.forEach(file => {
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts[0];
      if (!folderStructure[folderName]) folderStructure[folderName] = [];
      folderStructure[folderName].push(file);
    });

    setUploading(true);
    setUploadProgress(0);
    let uploadedCount = 0;
    const totalFiles = filesArray.length;

    try {
      for (const [folderName, folderFiles] of Object.entries(folderStructure)) {
        const folderRes = await axios.post(`${API}/folders`, { name: folderName, parentId: currentFolder });
        const newFolderId = folderRes.data.id;

        for (const file of folderFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folderId', newFolderId);

          try {
            await axios.post(`${API}/upload`, formData, {
              onUploadProgress: (e) => {
                const fileProgress = Math.round((e.loaded * 100) / e.total);
                const totalProgress = Math.round(((uploadedCount + fileProgress / 100) / totalFiles) * 100);
                setUploadProgress(totalProgress);
              }
            });
            uploadedCount++;
          } catch (err) {
            // Silent fail for individual files
          }
        }
      }
      showToast(`تم رفع المجلد بنجاح (${uploadedCount} ملف)`, 'success');
    } catch (err) {
      showToast('فشل في رفع المجلد', 'error');
    }

    setUploading(false);
    loadFiles(1, false);
    loadStorage();
  }, [currentFolder, loadFiles, loadStorage, showToast]);

  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      showToast('يرجى إدخال اسم المجلد', 'error');
      return;
    }
    try {
      await axios.post(`${API}/folders`, { name, parentId: currentFolder });
      setNewFolderName('');
      setShowNewFolder(false);
      showToast('تم إنشاء المجلد بنجاح', 'success');
      loadFiles(1, false);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في إنشاء المجلد'), 'error');
    }
  }, [newFolderName, currentFolder, loadFiles, showToast]);

  const downloadFile = useCallback(async (file) => {
    try {
      showToast('جاري تحضير الملف...', 'success');

      // استخدام axios مع blob للتحميل مع الـ token
      const response = await axios.get(`${API}/download-file/${file.id}`, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            // يمكن إضافة progress bar هنا
          }
        }
      });

      // إنشاء رابط للتحميل
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast('تم تحميل الملف بنجاح', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في تحميل الملف'), 'error');
    }
  }, [showToast]);

  const previewFile = useCallback(async (file) => {
    const canPreviewFile = file.type?.startsWith('image/') ||
      file.type?.startsWith('video/') ||
      file.type?.startsWith('audio/') ||
      file.type?.includes('pdf');

    if (!canPreviewFile) {
      downloadFile(file);
      return;
    }

    try {
      await axios.post(`${API}/recent/${file.id}`);
      const res = await axios.get(`${API}/download/${file.id}`);
      setPreview({ file, url: res.data.url });
    } catch (err) {
      showToast('فشل في تحميل المعاينة', 'error');
    }
  }, [downloadFile, showToast]);

  const deleteItem = useCallback(async (type, id) => {
    try {
      await axios.delete(`${API}/${type}s/${id}`);
      showToast('تم الحذف بنجاح', 'success');
      loadFiles(1, false);
      loadStorage();
      setContextMenu(null);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في الحذف'), 'error');
    }
  }, [loadFiles, loadStorage, showToast]);

  const renameItem = useCallback(async (type, id, newName) => {
    if (!newName?.trim()) {
      showToast('يرجى إدخال اسم صالح', 'error');
      return;
    }
    try {
      await axios.patch(`${API}/rename/${type}/${id}`, { name: newName.trim() });
      showToast('تم إعادة التسمية بنجاح', 'success');
      loadFiles(1, false);
      setContextMenu(null);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في إعادة التسمية'), 'error');
    }
  }, [loadFiles, showToast]);


  // Move/Copy operations
  const openMoveModal = useCallback(async (item, type, action) => {
    try {
      const res = await axios.get(`${API}/all-folders`);
      setAllFolders(res.data.folders);
      setMoveModal({ item, type, action });
      setContextMenu(null);
    } catch (err) {
      showToast('فشل في تحميل المجلدات', 'error');
    }
  }, [showToast]);

  const moveItem = useCallback(async (targetFolderId) => {
    if (!moveModal) return;
    try {
      if (moveModal.type === 'file') {
        await axios.patch(`${API}/move/file/${moveModal.item.id}`, { folderId: targetFolderId });
      } else {
        await axios.patch(`${API}/move/folder/${moveModal.item.id}`, { parentId: targetFolderId });
      }
      showToast('تم النقل بنجاح', 'success');
      setMoveModal(null);
      loadFiles(1, false);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في النقل'), 'error');
    }
  }, [moveModal, loadFiles, showToast]);

  const copyFile = useCallback(async (targetFolderId) => {
    if (!moveModal || moveModal.type !== 'file') return;
    try {
      await axios.post(`${API}/copy/file/${moveModal.item.id}`, { folderId: targetFolderId });
      showToast('تم النسخ بنجاح', 'success');
      setMoveModal(null);
      loadFiles(1, false);
    } catch (err) {
      showToast(getErrorMessage(err, 'فشل في النسخ'), 'error');
    }
  }, [moveModal, loadFiles, showToast]);

  // Drag & Drop handler for moving items between folders
  const handleDragDrop = useCallback(async (draggedItem, targetFolderId) => {
    try {
      if (draggedItem.type === 'file') {
        await axios.patch(`${API}/move/file/${draggedItem.id}`, { folderId: targetFolderId });
      } else if (draggedItem.type === 'folder') {
        // Prevent moving folder into itself
        if (draggedItem.id === targetFolderId) {
          showToast('لا يمكن نقل المجلد إلى نفسه', 'error');
          return;
        }
        await axios.patch(`${API}/move/folder/${draggedItem.id}`, { parentId: targetFolderId });
      }
      showToast(`تم نقل "${draggedItem.name}" بنجاح`, 'success');
      loadFiles(1, false);
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل في النقل', 'error');
    }
  }, [loadFiles, showToast]);

  // Star operations
  const toggleStar = useCallback(async (file) => {
    try {
      const res = await axios.patch(`${API}/star/${file.id}`);
      showToast(res.data.starred ? 'تمت الإضافة للمفضلة' : 'تمت الإزالة من المفضلة', 'success');
      if (currentView === 'starred') loadStarred();
      else loadFiles(1, false);
      setContextMenu(null);
    } catch (err) {
      showToast('فشل في تحديث المفضلة', 'error');
    }
  }, [currentView, loadFiles, showToast]);

  // View operations
  const loadStarred = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/starred`);
      setFiles(res.data.files);
      setFolders([]);
    } catch (err) {
      showToast('فشل في تحميل المفضلة', 'error');
    }
  }, [showToast]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/recent`);
      setFiles(res.data.files);
      setFolders([]);
    } catch (err) {
      showToast('فشل في تحميل الملفات الأخيرة', 'error');
    }
  }, [showToast]);

  const loadTrash = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/trash`);
      setTrashItems(res.data.items);
    } catch (err) {
      showToast('فشل في تحميل المحذوفات', 'error');
    }
  }, [showToast]);

  const loadByTag = useCallback(async (tag) => {
    try {
      const res = await axios.get(`${API}/tags/${tag.id}/files`);
      setFiles(res.data.files || []);
      setFolders([]);
    } catch (err) {
      showToast('فشل في تحميل ملفات الوسم', 'error');
    }
  }, [showToast]);

  const switchView = useCallback((view, tag = null) => {
    setCurrentView(view);
    setSelectedItems([]);
    setSearchQuery('');
    setFolderPath([]);
    setCurrentFolder(null);

    if (view === 'files') loadFiles(1, false);
    else if (view === 'starred') loadStarred();
    else if (view === 'recent') loadRecent();
    else if (view === 'trash') loadTrash();
    else if (view === 'tag' && tag) loadByTag(tag);
  }, [loadFiles, loadStarred, loadRecent, loadTrash, loadByTag]);

  // Trash operations
  const moveToTrash = useCallback(async (type, id) => {
    try {
      await axios.post(`${API}/trash/${type}/${id}`);
      showToast('تم النقل إلى المحذوفات', 'success');
      loadFiles(1, false);
      loadStorage();
      setContextMenu(null);
    } catch (err) {
      showToast('فشل في النقل للمحذوفات', 'error');
    }
  }, [loadFiles, loadStorage, showToast]);

  const restoreFromTrash = useCallback(async (id) => {
    try {
      await axios.post(`${API}/restore/${id}`);
      showToast('تم استعادة العنصر', 'success');
      loadTrash();
      loadStorage();
    } catch (err) {
      showToast('فشل في الاستعادة', 'error');
    }
  }, [loadTrash, loadStorage, showToast]);

  const deletePermanently = useCallback(async (id) => {
    try {
      await axios.delete(`${API}/trash/${id}`);
      showToast('تم الحذف نهائياً', 'success');
      loadTrash();
    } catch (err) {
      showToast('فشل في الحذف', 'error');
    }
  }, [loadTrash, showToast]);

  const emptyTrash = useCallback(async () => {
    if (!confirm('هل أنت متأكد من تفريغ المحذوفات؟ لا يمكن التراجع!')) return;
    try {
      await axios.delete(`${API}/trash`);
      showToast('تم تفريغ المحذوفات', 'success');
      loadTrash();
    } catch (err) {
      showToast('فشل في تفريغ المحذوفات', 'error');
    }
  }, [loadTrash, showToast]);

  // Share operations
  const shareFile = useCallback(async (file) => {
    try {
      if (file.shared) {
        setShareModal({ file, shareId: file.share_id });
      } else {
        const res = await axios.post(`${API}/share/${file.id}`);
        setShareModal({ file, shareId: res.data.share_id });
        loadFiles(1, false);
      }
      setContextMenu(null);
    } catch (err) {
      showToast('فشل في إنشاء رابط المشاركة', 'error');
    }
  }, [loadFiles, showToast]);

  const removeShare = useCallback(async (fileId) => {
    try {
      await axios.delete(`${API}/share/${fileId}`);
      showToast('تم إلغاء المشاركة', 'success');
      setShareModal(null);
      loadFiles(1, false);
    } catch (err) {
      showToast('فشل في إلغاء المشاركة', 'error');
    }
  }, [loadFiles, showToast]);

  // Navigation
  const openFolder = useCallback((folder) => {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolder(folder.id);
    setSelectedItems([]);
    setSearchQuery('');
  }, []);

  const goToFolder = useCallback((index) => {
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolder(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolder(newPath[newPath.length - 1].id);
    }
    setSelectedItems([]);
    setSearchQuery('');
  }, [folderPath]);

  // Selection
  const handleItemClick = useCallback((e, item, type) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const key = `${type}-${item.id}`;
        return prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      });
    } else {
      setSelectedItems([`${type}-${item.id}`]);
    }
  }, []);

  const handleContextMenu = useCallback((e, item, type) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item, type });
  }, []);

  // Sort
  const toggleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  // ZIP download
  const downloadAsZip = useCallback(async () => {
    if (selectedFileIds.length === 0) {
      showToast('يرجى تحديد ملفات للتحميل', 'error');
      return;
    }
    try {
      showToast('جاري تحضير ملف ZIP...', 'success');
      const response = await axios.post(`${API}/download-zip`, { fileIds: selectedFileIds }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'files.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('تم تحميل الملفات بنجاح', 'success');
    } catch (err) {
      showToast('فشل في تحميل الملفات', 'error');
    }
  }, [selectedFileIds, showToast]);

  // Scroll handler
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      loadMoreFiles();
    }
  }, [loadMoreFiles]);


  // Render - Auth checking
  if (authChecking) {
    return (
      <div className="app">
        <div className="loading-state" style={{ minHeight: '100vh' }}>
          <div className="spinner"></div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Render - Login/Register page
  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  // Render - Main app
  return (
    <div className="app" onClick={() => { setContextMenu(null); setShowUserMenu(false); }}>
      {/* Custom Title Bar for Electron */}
      <TitleBar />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}

      {/* Advanced Search Modal */}
      {showAdvancedSearch && (
        <AdvancedSearch
          onSearch={handleAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          initialQuery={searchQuery}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} showToast={showToast} />
      )}

      {/* Duplicates Modal */}
      {showDuplicates && (
        <DuplicatesModal
          onClose={() => setShowDuplicates(false)}
          onDeleted={() => loadFiles(1, false)}
        />
      )}

      {/* Storage Analytics Modal */}
      {showStorageAnalytics && (
        <StorageAnalyticsModal
          onClose={() => setShowStorageAnalytics(false)}
          onCleanup={() => { loadFiles(1, false); loadStorage(); }}
        />
      )}

      {/* Tags Manager Modal */}
      {showTagsManager && (
        <TagsManager
          onClose={() => setShowTagsManager(false)}
          onTagSelect={(tag) => {
            setSelectedTag(tag);
            setShowTagsManager(false);
            switchView('tag', tag);
          }}
        />
      )}

      {/* Header */}
      <header className="header">
        <div className="header-right">
          <div className="logo">
            <img src="/icons/logo.svg" alt="Logo" style={{ width: '32px', height: '32px' }} />
            <span>التخزين السحابي</span>
          </div>
        </div>

        <div className="search-box" onClick={() => setShowAdvancedSearch(true)}>
          <FiSearch />
          <input
            type="text"
            placeholder="البحث في الملفات... (اضغط للبحث المتقدم)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowAdvancedSearch(true)}
            readOnly
          />
          {searchResults && (
            <button className="clear-search" onClick={(e) => { e.stopPropagation(); clearSearchResults(); }}>
              <FiX />
            </button>
          )}
        </div>

        <div className="header-left">
          {/* Storage Info */}
          <div className="storage-info">
            {userStorage.unlimited ? (
              <span>{formatSize(storageUsed)} مستخدم</span>
            ) : (
              <span>{formatSize(storageUsed)} / {formatSize(userStorage.limit)}</span>
            )}
          </div>

          {/* User Menu */}
          <div className="user-menu">
            <button
              className="user-btn"
              onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
            >
              <FiUser />
              <span className="user-name">{currentUser?.displayName || currentUser?.username}</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="user-dropdown-header">
                  <strong>{currentUser?.displayName || currentUser?.username}</strong>
                  <small>{currentUser?.email}</small>
                  <span className="user-role">{currentUser?.role === 'super_admin' ? 'مدير أعلى' : currentUser?.role === 'admin' ? 'مدير' : 'مستخدم'}</span>
                </div>
                <button onClick={() => { setShowChangePassword(true); setShowUserMenu(false); }}>
                  <FiKey /> تغيير كلمة المرور
                </button>
                <button onClick={() => { setShowSettings(true); setShowUserMenu(false); }}>
                  <FiSettings /> الإعدادات
                </button>
                {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                  <button onClick={() => window.open('/admin', '_blank')}>
                    <FiSettings /> لوحة التحكم
                  </button>
                )}
                <button className="logout" onClick={handleLogout}>
                  <FiLogOut /> تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="upload-buttons">
            <label className="upload-btn">
              <FiUpload />
              <span>رفع ملفات</span>
              <input type="file" multiple onChange={(e) => onDrop(Array.from(e.target.files))} hidden />
            </label>
            <label className="upload-btn folder-upload">
              <FiFolder />
              <span>رفع مجلد</span>
              <input type="file" webkitdirectory="" directory="" multiple onChange={(e) => handleFolderUpload(e.target.files)} hidden />
            </label>
          </div>

          <nav className="nav-menu" role="navigation" aria-label="القائمة الرئيسية">
            <button className={`nav-item ${currentView === 'files' ? 'active' : ''}`} onClick={() => switchView('files')} aria-current={currentView === 'files' ? 'page' : undefined}>
              <FiHardDrive aria-hidden="true" /><span>ملفاتي</span>
            </button>
            <button className={`nav-item ${currentView === 'starred' ? 'active' : ''}`} onClick={() => switchView('starred')} aria-current={currentView === 'starred' ? 'page' : undefined}>
              <FiStar aria-hidden="true" /><span>المفضلة</span>
            </button>
            <button className={`nav-item ${currentView === 'recent' ? 'active' : ''}`} onClick={() => switchView('recent')} aria-current={currentView === 'recent' ? 'page' : undefined}>
              <FiClock aria-hidden="true" /><span>الأخيرة</span>
            </button>
            <button className={`nav-item ${currentView === 'trash' ? 'active' : ''}`} onClick={() => switchView('trash')} aria-current={currentView === 'trash' ? 'page' : undefined}>
              <FiTrash2 aria-hidden="true" /><span>المحذوفات</span>
            </button>
            <hr className="nav-divider" aria-hidden="true" />
            <button className="nav-item" onClick={() => setShowNewFolder(true)} aria-label="إنشاء مجلد جديد">
              <FiFolder aria-hidden="true" /><span>مجلد جديد</span>
            </button>
            <button className="nav-item" onClick={() => setShowDuplicates(true)} aria-label="عرض الملفات المكررة">
              <FiCopy aria-hidden="true" /><span>الملفات المكررة</span>
            </button>
            <button className="nav-item" onClick={() => setShowStorageAnalytics(true)} aria-label="تحليل التخزين">
              <FiHardDrive aria-hidden="true" /><span>تحليل التخزين</span>
            </button>
            <button className="nav-item" onClick={() => setShowTagsManager(true)} aria-label="إدارة الوسوم">
              <FiTag aria-hidden="true" /><span>الوسوم</span>
            </button>
            <button className="nav-item" onClick={() => setShowCollections(true)} aria-label="إدارة المجموعات">
              <FiPackage aria-hidden="true" /><span>المجموعات</span>
            </button>
            <button className="nav-item ai-btn" onClick={() => setShowAIPanel(true)} aria-label="فتح لوحة الذكاء الاصطناعي">
              <FiCpu aria-hidden="true" /><span>الذكاء الاصطناعي</span>
            </button>
          </nav>

          <div className="storage-bar" role="region" aria-label="معلومات التخزين">
            <div className="storage-label"><FiHardDrive /><span>التخزين</span></div>
            <div
              className="storage-progress"
              role="progressbar"
              aria-valuenow={userStorage.unlimited ? 0 : Math.round((storageUsed / userStorage.limit) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="storage-fill"
                style={{
                  width: userStorage.unlimited
                    ? '0%'
                    : `${Math.min(100, Math.round((storageUsed / userStorage.limit) * 100))}%`
                }}
              />
            </div>
            <span className="storage-text">
              {userStorage.unlimited
                ? `${formatSize(storageUsed)} من غير محدود`
                : `${formatSize(storageUsed)} من ${formatSize(userStorage.limit)}`
              }
            </span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="content" {...getRootProps()} onScroll={handleScroll}>
          <input {...getInputProps()} />

          {isDragActive && (
            <div className="drop-overlay">
              <FiUpload size={48} />
              <p>أفلت الملفات هنا للرفع</p>
            </div>
          )}

          {/* Search Results Info */}
          {searchResults && (
            <div className="search-results-info">
              <div>
                <span>نتائج البحث عن: </span>
                <span className="query">"{searchResults.query}"</span>
                <span className="count"> ({files.length} ملف، {folders.length} مجلد)</span>
              </div>
              <button className="clear-search-btn" onClick={clearSearchResults}>
                <FiX /> مسح البحث
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="toolbar">
            <div className="breadcrumb">
              {searchResults ? (
                <span>نتائج البحث</span>
              ) : currentView === 'tag' && selectedTag ? (
                <>
                  <button onClick={() => switchView('files')}>ملفاتي</button>
                  <FiChevronLeft />
                  <span className="tag-breadcrumb">
                    <FiTag /> {selectedTag.name}
                  </span>
                </>
              ) : (
                <>
                  <button onClick={() => goToFolder(-1)}>ملفاتي</button>
                  {folderPath.map((folder, index) => (
                    <span key={folder.id}>
                      <FiChevronLeft />
                      <button onClick={() => goToFolder(index)}>{folder.name}</button>
                    </span>
                  ))}
                </>
              )}
            </div>

            <div className="toolbar-actions">
              <div className="sort-buttons">
                <button className={sortBy === 'name' ? 'active' : ''} onClick={() => toggleSort('name')}>
                  الاسم {sortBy === 'name' && (sortOrder === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                </button>
                <button className={sortBy === 'date' ? 'active' : ''} onClick={() => toggleSort('date')}>
                  التاريخ {sortBy === 'date' && (sortOrder === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                </button>
                <button className={sortBy === 'size' ? 'active' : ''} onClick={() => toggleSort('size')}>
                  الحجم {sortBy === 'size' && (sortOrder === 'asc' ? <FiArrowUp /> : <FiArrowDown />)}
                </button>
              </div>

              {selectedFileIds.length > 1 && (
                <button className="zip-btn" onClick={downloadAsZip}><FiPackage /> ZIP</button>
              )}

              <div className="view-toggle">
                <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><FiGrid /></button>
                <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><FiList /></button>
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="upload-progress-enhanced" role="status" aria-live="polite">
              <div className="upload-progress-header">
                <span className="upload-icon">📤</span>
                <span className="upload-text">جاري الرفع...</span>
                <span className="upload-percent">{uploadProgress}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill animated"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}

          {/* Trash View */}
          {currentView === 'trash' && (
            <>
              <div className="trash-header">
                <span>العناصر في المحذوفات سيتم حذفها نهائياً بعد 30 يوم</span>
                {trashItems.length > 0 && (
                  <button className="empty-trash-btn" onClick={emptyTrash}><FiTrash2 /> تفريغ المحذوفات</button>
                )}
              </div>
              <div className={`files-container ${viewMode}`}>
                {trashItems.map(item => (
                  <div key={item.id} className="file-item trash-item">
                    <div className="file-icon">{item.isFolder ? <FiFolder /> : <FiFile />}</div>
                    <div className="file-info">
                      <span className="file-name">{item.name}</span>
                      <span className="file-meta">{item.isFolder ? 'مجلد' : formatSize(item.size)}</span>
                    </div>
                    <div className="trash-actions">
                      <button onClick={() => restoreFromTrash(item.id)} title="استعادة"><FiRefreshCw /></button>
                      <button onClick={() => { if (confirm('حذف نهائي؟')) deletePermanently(item.id); }} title="حذف نهائي" className="delete"><FiTrash2 /></button>
                    </div>
                  </div>
                ))}
                {trashItems.length === 0 && (
                  <div className="empty-state"><FiTrash2 size={64} /><h3>المحذوفات فارغة</h3></div>
                )}
              </div>
            </>
          )}

          {/* Files Grid/List */}
          {currentView !== 'trash' && (
            <div className={`files-container ${viewMode}`}>
              {folders.map(folder => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  isSelected={selectedItems.includes(`folder-${folder.id}`)}
                  onClick={handleItemClick}
                  onDoubleClick={openFolder}
                  onContextMenu={handleContextMenu}
                  onDrop={handleDragDrop}
                />
              ))}

              {files.map(file => (
                <FileItemComponent
                  key={file.id}
                  file={file}
                  isSelected={selectedItems.includes(`file-${file.id}`)}
                  thumbnail={thumbnails[file.id]}
                  searchQuery={searchResults?.query || debouncedSearchQuery}
                  onClick={handleItemClick}
                  onDoubleClick={previewFile}
                  onContextMenu={handleContextMenu}
                  onDrop={handleDragDrop}
                />
              ))}

              {folders.length === 0 && files.length === 0 && !loading && (
                <div className="empty-state">
                  {currentView === 'files' && <FiUpload size={64} />}
                  {currentView === 'starred' && <FiStar size={64} />}
                  {currentView === 'recent' && <FiClock size={64} />}
                  <h3>
                    {currentView === 'files' && 'لا توجد ملفات'}
                    {currentView === 'starred' && 'لا توجد ملفات مفضلة'}
                    {currentView === 'recent' && 'لا توجد ملفات أخيرة'}
                  </h3>
                  {currentView === 'files' && <p>اسحب الملفات هنا أو اضغط على "جديد" للرفع</p>}
                </div>
              )}

              {loading && <div className="loading-state"><div className="spinner"></div><p>جاري التحميل...</p></div>}
              {loadingMore && <div className="loading-more"><div className="spinner small"></div><span>جاري تحميل المزيد...</span></div>}

              {pagination.total > 0 && currentView === 'files' && (
                <div className="pagination-info">
                  <span>عرض {files.length} من {pagination.total} ملف</span>
                  {pagination.hasMore && !loadingMore && <button className="load-more-btn" onClick={loadMoreFiles}>تحميل المزيد</button>}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Context Menu */}
      <ContextMenu
        contextMenu={contextMenu}
        onPreview={previewFile}
        onDownload={downloadFile}
        onShare={shareFile}
        onToggleStar={toggleStar}
        onShowInfo={(file) => setFileInfoModal(file)}
        onMove={openMoveModal}
        onCopy={openMoveModal}
        onRename={(item, type) => { setRenameModal({ item, type }); setContextMenu(null); }}
        onDelete={moveToTrash}
        onVersionHistory={(file) => setShowVersionHistory(file)}
        onComments={(file) => setShowComments(file)}
        onAddToCollection={(file) => { setAddToCollectionFile(file); setShowCollections(true); }}
        onManageTags={(file) => { setFileInfoModal(file); setShowTagsManager(true); }}
        onClose={() => setContextMenu(null)}
      />

      {/* Modals */}
      <Suspense fallback={<div className="loading-state"><div className="spinner"></div></div>}>
        {preview && (
          <FilePreview
            file={preview.file}
            fileUrl={preview.url}
            allFiles={files}
            onClose={() => setPreview(null)}
            onDownload={() => downloadFile(preview.file)}
            onNext={() => {
              const idx = files.findIndex(f => f.id === preview.file.id);
              if (idx < files.length - 1) previewFile(files[idx + 1]);
            }}
            onPrev={() => {
              const idx = files.findIndex(f => f.id === preview.file.id);
              if (idx > 0) previewFile(files[idx - 1]);
            }}
            hasNext={files.findIndex(f => f.id === preview.file.id) < files.length - 1}
            hasPrev={files.findIndex(f => f.id === preview.file.id) > 0}
          />
        )}
      </Suspense>

      <NewFolderModal
        show={showNewFolder}
        folderName={newFolderName}
        onNameChange={setNewFolderName}
        onCreate={createFolder}
        onClose={() => setShowNewFolder(false)}
      />

      <MoveModal
        moveModal={moveModal}
        allFolders={allFolders}
        onMove={moveItem}
        onCopy={copyFile}
        onClose={() => setMoveModal(null)}
      />

      <ShareModal
        shareModal={shareModal}
        onRemoveShare={removeShare}
        onClose={() => setShareModal(null)}
        onCopyLink={() => showToast('تم نسخ الرابط', 'success')}
      />

      <FileInfoModal
        file={fileInfoModal}
        onClose={() => setFileInfoModal(null)}
        formatSize={formatSize}
        formatDate={formatDate}
      />

      {/* Rename Modal */}
      {renameModal && (
        <RenameModal
          item={renameModal.item}
          type={renameModal.type}
          onRename={renameItem}
          onClose={() => setRenameModal(null)}
        />
      )}

      {/* Version History Modal */}
      <Suspense fallback={<div className="loading-state"><div className="spinner"></div></div>}>
        {showVersionHistory && (
          <VersionHistoryModal
            file={showVersionHistory}
            onClose={() => setShowVersionHistory(null)}
            onRestore={() => { loadFiles(1, false); showToast('تم استعادة الإصدار بنجاح', 'success'); }}
          />
        )}
      </Suspense>

      {/* Comments Panel */}
      <Suspense fallback={<div className="loading-state"><div className="spinner"></div></div>}>
        {showComments && (
          <CommentsPanel
            file={showComments}
            currentUser={currentUser}
            onClose={() => setShowComments(null)}
          />
        )}
      </Suspense>

      {/* Collections Manager */}
      <Suspense fallback={<div className="loading-state"><div className="spinner"></div></div>}>
        {showCollections && (
          <CollectionsManager
            onClose={() => { setShowCollections(false); setAddToCollectionFile(null); }}
            fileToAdd={addToCollectionFile}
            onFileAdded={() => showToast('تمت إضافة الملف للمجموعة', 'success')}
          />
        )}
      </Suspense>

      {/* AI Panel */}
      <Suspense fallback={<div className="loading-state"><div className="spinner"></div></div>}>
        {showAIPanel && (
          <AIPanel
            isOpen={showAIPanel}
            onClose={() => { setShowAIPanel(false); setAiSelectedFile(null); }}
            selectedFile={aiSelectedFile || (selectedItems.length === 1 && selectedItems[0].startsWith('file-')
              ? files.find(f => f.id === selectedItems[0].replace('file-', ''))
              : null)}
            onTagsAdded={() => loadFiles(1, false)}
            showToast={showToast}
          />
        )}
      </Suspense>

      {/* Smart AI Assistant */}
      <Suspense fallback={null}>
        {showSmartAssistant && (
          <SmartAssistant
            isOpen={showSmartAssistant}
            onClose={() => setShowSmartAssistant(false)}
            showToast={showToast}
          />
        )}
      </Suspense>

      {/* Floating Assistant Button */}
      <button
        className="assistant-fab"
        onClick={() => setShowSmartAssistant(true)}
        title="المساعد الذكي"
      >
        <FiCpu />
        <span className="badge">AI</span>
      </button>
    </div>
  );
}

export default App;
