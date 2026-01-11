import { FILE_TYPES } from './constants';

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  if (diffDay < 7) return `منذ ${diffDay} يوم`;
  if (diffWeek < 4) return `منذ ${diffWeek} أسبوع`;
  if (diffMonth < 12) return `منذ ${diffMonth} شهر`;
  return `منذ ${diffYear} سنة`;
}

/**
 * Format date to localized string
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Get file type category from extension
 */
export function getFileType(filename: string): string {
  const ext = getFileExtension(filename);
  
  if (FILE_TYPES.IMAGE.includes(ext as any)) return 'image';
  if (FILE_TYPES.VIDEO.includes(ext as any)) return 'video';
  if (FILE_TYPES.AUDIO.includes(ext as any)) return 'audio';
  if (FILE_TYPES.DOCUMENT.includes(ext as any)) return 'document';
  if (FILE_TYPES.TEXT.includes(ext as any)) return 'text';
  if (FILE_TYPES.CODE.includes(ext as any)) return 'code';
  if (FILE_TYPES.ARCHIVE.includes(ext as any)) return 'archive';
  
  return 'default';
}

/**
 * Check if file is previewable
 */
export function isPreviewable(filename: string): boolean {
  const type = getFileType(filename);
  return ['image', 'video', 'audio', 'text', 'code'].includes(type) || 
         getFileExtension(filename) === 'pdf';
}

/**
 * Format upload/download speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const k = 1024;
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  
  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format remaining time
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} ثانية`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} دقيقة`;
  return `${Math.ceil(seconds / 3600)} ساعة`;
}

/**
 * Truncate filename if too long
 */
export function truncateFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;
  
  const ext = getFileExtension(filename);
  const name = filename.slice(0, filename.length - ext.length - 1);
  const truncatedName = name.slice(0, maxLength - ext.length - 4) + '...';
  
  return ext ? `${truncatedName}.${ext}` : truncatedName;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
