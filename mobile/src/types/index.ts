// User & Auth Types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: string;
  storageUsed: number;
  storageLimit: number;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface TokenResponse {
  token: string;
  refreshToken: string;
}

// File & Folder Types
export interface File {
  id: string;
  name: string;
  type: 'file';
  size: number;
  mimeType: string;
  folderId: string | null;
  thumbnailUrl?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
  isOffline?: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
  isFavorite?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  type: 'folder';
  parentId: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export type FileOrFolder = File | Folder;

// Upload Types
export interface UploadItem {
  id: string;
  localUri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  folderId: string | null;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'failed';
  progress: number;
  uploadedBytes: number;
  error?: string;
  createdAt: number;
}

export interface LocalFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

// Download Types
export interface DownloadItem {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  localPath?: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progress: number;
  downloadedBytes: number;
  error?: string;
}

// Share Types
export interface ShareLink {
  id: string;
  fileId: string;
  url: string;
  password?: string;
  expiresAt?: string;
  downloadLimit?: number;
  downloadCount: number;
  createdAt: string;
}

export interface ShareOptions {
  password?: string;
  expiresAt?: string;
  downloadLimit?: number;
  permission: 'view' | 'download' | 'edit';
}

export interface SharedFile {
  id: string;
  file: File;
  sharedBy: User;
  permission: 'view' | 'download' | 'edit';
  sharedAt: string;
}

// Sync Types
export interface SyncStatus {
  isEnabled: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  pendingCount: number;
  failedCount: number;
}

export interface CameraUploadOptions {
  wifiOnly: boolean;
  includeVideos: boolean;
  targetFolderId?: string;
}

export interface OfflineFile {
  fileId: string;
  localPath: string;
  lastSyncAt: string;
  size: number;
}

// Settings Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type ViewMode = 'list' | 'grid';
export type SortOption = 'name' | 'date' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface Settings {
  theme: ThemeMode;
  viewMode: ViewMode;
  sortBy: SortOption;
  sortOrder: SortOrder;
  cameraUpload: CameraUploadOptions;
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
}

// API Types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Notification Types
export interface AppNotification {
  id: string;
  type: 'share' | 'upload' | 'download' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// Progress Callback
export type ProgressCallback = (progress: number, loaded: number, total: number) => void;
