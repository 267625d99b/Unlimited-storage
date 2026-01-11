// API Configuration
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.100:3000/api' // Change to your local IP
  : 'https://your-production-server.com/api';

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  SETTINGS: 'settings',
  UPLOAD_QUEUE: 'upload_queue',
  DOWNLOAD_QUEUE: 'download_queue',
  OFFLINE_FILES: 'offline_files',
  THUMBNAIL_CACHE: 'thumbnail_cache',
} as const;

// File Types
export const FILE_TYPES = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  VIDEO: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'],
  AUDIO: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
  DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  TEXT: ['txt', 'md', 'json', 'xml', 'csv'],
  CODE: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'],
  ARCHIVE: ['zip', 'rar', '7z', 'tar', 'gz'],
} as const;

// MIME Types
export const MIME_TYPES: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  // Videos
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Text
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
};

// Upload Configuration
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
  MAX_CONCURRENT_UPLOADS: 3,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Download Configuration
export const DOWNLOAD_CONFIG = {
  MAX_CONCURRENT_DOWNLOADS: 3,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  THUMBNAIL_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  FILE_LIST_MAX_AGE: 5 * 60 * 1000, // 5 minutes
  MAX_THUMBNAIL_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
} as const;

// UI Configuration
export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  ITEMS_PER_PAGE: 50,
} as const;

// Colors
export const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  background: {
    light: '#ffffff',
    dark: '#0f172a',
  },
  surface: {
    light: '#f8fafc',
    dark: '#1e293b',
  },
  text: {
    light: '#0f172a',
    dark: '#f8fafc',
  },
  textSecondary: {
    light: '#64748b',
    dark: '#94a3b8',
  },
  border: {
    light: '#e2e8f0',
    dark: '#334155',
  },
} as const;

// File Icons (Expo Vector Icons names)
export const FILE_ICONS: Record<string, string> = {
  folder: 'folder',
  image: 'image',
  video: 'play-circle',
  audio: 'music',
  pdf: 'file-pdf-o',
  document: 'file-word-o',
  spreadsheet: 'file-excel-o',
  presentation: 'file-powerpoint-o',
  text: 'file-text-o',
  code: 'file-code-o',
  archive: 'file-archive-o',
  default: 'file-o',
};
