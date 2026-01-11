import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { tokenStorage } from './storage';
import type { 
  AuthResponse, 
  TokenResponse, 
  File, 
  Folder, 
  FileOrFolder,
  ShareLink,
  ShareOptions,
  SharedFile,
  PaginatedResponse,
  ProgressCallback,
} from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post<TokenResponse>(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken }
          );
          
          await tokenStorage.setTokens(
            response.data.token,
            response.data.refreshToken
          );
          
          originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        await tokenStorage.clearTokens();
        // Trigger logout in auth store
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/users/login', { email, password });
    return response.data;
  },

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/users/register', { username, email, password });
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/users/logout');
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/users/refresh', { refreshToken });
    return response.data;
  },

  async getProfile(): Promise<AuthResponse['user']> {
    const response = await api.get('/users/me');
    return response.data.user;
  },
};

// Files API
export const filesApi = {
  async getFiles(folderId?: string | null): Promise<FileOrFolder[]> {
    const params = folderId ? { folderId } : {};
    const response = await api.get('/files', { params });
    // Transform response to match our types
    const { files = [], folders = [] } = response.data;
    const transformedFiles = files.map((f: any) => ({
      ...f,
      type: 'file' as const,
      mimeType: f.type || f.mime_type || 'application/octet-stream',
      name: f.original_name || f.name,
      updatedAt: f.updated_at || f.created_at,
      createdAt: f.created_at,
      isFavorite: f.starred,
    }));
    const transformedFolders = folders.map((f: any) => ({
      ...f,
      type: 'folder' as const,
      itemCount: f.item_count || 0,
      updatedAt: f.updated_at || f.created_at,
      createdAt: f.created_at,
    }));
    return [...transformedFolders, ...transformedFiles];
  },

  async getFile(id: string): Promise<File> {
    const response = await api.get(`/file-info/${id}`);
    const f = response.data;
    return {
      ...f,
      type: 'file',
      mimeType: f.type || f.mime_type || 'application/octet-stream',
      name: f.original_name || f.name,
      updatedAt: f.updated_at || f.created_at,
      createdAt: f.created_at,
      isFavorite: f.starred,
    };
  },

  async deleteFile(id: string): Promise<void> {
    await api.delete(`/files/${id}`);
  },

  async renameFile(id: string, name: string): Promise<File> {
    const response = await api.patch(`/rename/file/${id}`, { name });
    return response.data;
  },

  async moveFile(id: string, folderId: string | null): Promise<File> {
    const response = await api.patch(`/move/file/${id}`, { folderId });
    return response.data;
  },

  async toggleFavorite(id: string): Promise<File> {
    const response = await api.patch(`/star/${id}`);
    return response.data;
  },

  async getFavorites(): Promise<File[]> {
    const response = await api.get('/starred');
    return (response.data.files || []).map((f: any) => ({
      ...f,
      type: 'file',
      mimeType: f.type || f.mime_type,
      name: f.original_name || f.name,
      isFavorite: true,
    }));
  },

  async getRecent(): Promise<File[]> {
    const response = await api.get('/recent');
    return (response.data.files || []).map((f: any) => ({
      ...f,
      type: 'file',
      mimeType: f.type || f.mime_type,
      name: f.original_name || f.name,
    }));
  },

  async search(query: string): Promise<FileOrFolder[]> {
    const response = await api.get('/search', { params: { q: query } });
    const { files = [], folders = [] } = response.data;
    const transformedFiles = files.map((f: any) => ({
      ...f,
      type: 'file' as const,
      mimeType: f.type || f.mime_type,
      name: f.original_name || f.name,
    }));
    const transformedFolders = folders.map((f: any) => ({
      ...f,
      type: 'folder' as const,
    }));
    return [...transformedFolders, ...transformedFiles];
  },

  async getTrash(): Promise<FileOrFolder[]> {
    const response = await api.get('/trash');
    return response.data.items || [];
  },

  async restoreFromTrash(id: string): Promise<void> {
    await api.post(`/restore/${id}`);
  },

  async emptyTrash(): Promise<void> {
    await api.delete('/trash');
  },
};

// Folders API
export const foldersApi = {
  async createFolder(name: string, parentId?: string | null): Promise<Folder> {
    const response = await api.post('/folders', { name, parentId });
    return {
      ...response.data,
      type: 'folder',
    };
  },

  async getFolder(id: string): Promise<Folder> {
    // Get folder info from all-folders endpoint
    const response = await api.get('/all-folders');
    const folder = response.data.folders?.find((f: any) => f.id === id);
    if (!folder) throw new Error('Folder not found');
    return {
      ...folder,
      type: 'folder',
    };
  },

  async deleteFolder(id: string): Promise<void> {
    await api.delete(`/folders/${id}`);
  },

  async renameFolder(id: string, name: string): Promise<Folder> {
    const response = await api.patch(`/rename/folder/${id}`, { name });
    return response.data;
  },

  async moveFolder(id: string, parentId: string | null): Promise<Folder> {
    const response = await api.patch(`/move/folder/${id}`, { parentId });
    return response.data;
  },

  async getBreadcrumbs(id: string): Promise<Folder[]> {
    // Build breadcrumbs from all-folders
    const response = await api.get('/all-folders');
    const allFolders = response.data.folders || [];
    const breadcrumbs: Folder[] = [];
    
    let currentId: string | null = id;
    while (currentId) {
      const folder = allFolders.find((f: any) => f.id === currentId);
      if (folder) {
        breadcrumbs.unshift({ ...folder, type: 'folder' });
        currentId = folder.parent_id;
      } else {
        break;
      }
    }
    
    return breadcrumbs;
  },
};

// Sharing API
export const sharingApi = {
  async createShareLink(fileId: string, options: ShareOptions): Promise<ShareLink> {
    const response = await api.post(`/share/${fileId}`, options);
    return response.data;
  },

  async getShareLinks(fileId: string): Promise<ShareLink[]> {
    const response = await api.get(`/sharing/file/${fileId}/links`);
    return response.data.links || [];
  },

  async deleteShareLink(linkId: string): Promise<void> {
    await api.delete(`/share/${linkId}`);
  },

  async getSharedWithMe(): Promise<SharedFile[]> {
    try {
      const response = await api.get('/sharing/shared-with-me');
      return response.data.files || [];
    } catch {
      return [];
    }
  },

  async getSharedByMe(): Promise<ShareLink[]> {
    try {
      const response = await api.get('/sharing/my-shares');
      return response.data.shares || [];
    } catch {
      return [];
    }
  },
};

// Storage API
export const storageApi = {
  async getStorageInfo(): Promise<{ used: number; limit: number; percentage: number }> {
    const response = await api.get('/storage/info');
    return response.data;
  },

  async getStorageAnalytics(): Promise<{
    byType: Record<string, number>;
    largestFiles: File[];
    unusedFiles: File[];
  }> {
    const response = await api.get('/storage/analytics');
    return response.data;
  },
};

// Upload helper
export async function uploadFile(
  uri: string,
  fileName: string,
  mimeType: string,
  folderId: string | null,
  onProgress?: ProgressCallback
): Promise<File> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: mimeType,
  } as any);
  
  if (folderId) {
    formData.append('folderId', folderId);
  }

  const response = await api.post<File>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = progressEvent.loaded / progressEvent.total;
        onProgress(progress, progressEvent.loaded, progressEvent.total);
      }
    },
  });

  return response.data;
}

// Download URL helper
export function getDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/download/${fileId}`;
}

// Thumbnail URL helper
export function getThumbnailUrl(fileId: string): string {
  return `${API_BASE_URL}/thumbnail/${fileId}`;
}

export default api;
