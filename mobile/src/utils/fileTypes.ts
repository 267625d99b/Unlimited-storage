import { FILE_TYPES, FILE_ICONS, MIME_TYPES } from './constants';

export interface FileTypeInfo {
  type: string;
  icon: string;
  color: string;
  canPreview: boolean;
  label?: string;
}

const TYPE_COLORS: Record<string, string> = {
  folder: '#f59e0b',
  image: '#22c55e',
  video: '#ef4444',
  audio: '#8b5cf6',
  pdf: '#dc2626',
  document: '#2563eb',
  spreadsheet: '#16a34a',
  presentation: '#ea580c',
  text: '#64748b',
  code: '#06b6d4',
  archive: '#a855f7',
  default: '#94a3b8',
};

/**
 * Get file type info from filename or mime type
 */
export function getFileTypeInfo(filename: string, mimeType?: string): FileTypeInfo {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // Check by extension first
  if (FILE_TYPES.IMAGE.includes(ext as any)) {
    return { type: 'image', icon: 'image', color: TYPE_COLORS.image, canPreview: true, label: 'صورة' };
  }
  if (FILE_TYPES.VIDEO.includes(ext as any)) {
    return { type: 'video', icon: 'play-circle', color: TYPE_COLORS.video, canPreview: true, label: 'فيديو' };
  }
  if (FILE_TYPES.AUDIO.includes(ext as any)) {
    return { type: 'audio', icon: 'musical-notes', color: TYPE_COLORS.audio, canPreview: true, label: 'صوت' };
  }
  if (ext === 'pdf') {
    return { type: 'pdf', icon: 'document-text', color: TYPE_COLORS.pdf, canPreview: true, label: 'PDF' };
  }
  if (['doc', 'docx'].includes(ext)) {
    return { type: 'document', icon: 'document', color: TYPE_COLORS.document, canPreview: false, label: 'مستند Word' };
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return { type: 'spreadsheet', icon: 'grid', color: TYPE_COLORS.spreadsheet, canPreview: false, label: 'جدول Excel' };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { type: 'presentation', icon: 'easel', color: TYPE_COLORS.presentation, canPreview: false, label: 'عرض تقديمي' };
  }
  if (FILE_TYPES.TEXT.includes(ext as any)) {
    return { type: 'text', icon: 'document-text', color: TYPE_COLORS.text, canPreview: true, label: 'نص' };
  }
  if (FILE_TYPES.CODE.includes(ext as any)) {
    return { type: 'code', icon: 'code-slash', color: TYPE_COLORS.code, canPreview: true, label: 'كود' };
  }
  if (FILE_TYPES.ARCHIVE.includes(ext as any)) {
    return { type: 'archive', icon: 'archive', color: TYPE_COLORS.archive, canPreview: false, label: 'أرشيف' };
  }
  
  // Fallback to mime type
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return { type: 'image', icon: 'image', color: TYPE_COLORS.image, canPreview: true, label: 'صورة' };
    }
    if (mimeType.startsWith('video/')) {
      return { type: 'video', icon: 'play-circle', color: TYPE_COLORS.video, canPreview: true, label: 'فيديو' };
    }
    if (mimeType.startsWith('audio/')) {
      return { type: 'audio', icon: 'musical-notes', color: TYPE_COLORS.audio, canPreview: true, label: 'صوت' };
    }
    if (mimeType.startsWith('text/')) {
      return { type: 'text', icon: 'document-text', color: TYPE_COLORS.text, canPreview: true, label: 'نص' };
    }
  }
  
  return { type: 'default', icon: 'document', color: TYPE_COLORS.default, canPreview: false, label: 'ملف' };
}

/**
 * Get MIME type from extension
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if file is an image
 */
export function isImage(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES.IMAGE.includes(ext as any);
}

/**
 * Check if file is a video
 */
export function isVideo(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES.VIDEO.includes(ext as any);
}

/**
 * Check if file is audio
 */
export function isAudio(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES.AUDIO.includes(ext as any);
}

/**
 * Check if file is a PDF
 */
export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

/**
 * Check if file is text-based (can be displayed as text)
 */
export function isTextBased(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES.TEXT.includes(ext as any) || FILE_TYPES.CODE.includes(ext as any);
}

/**
 * Get language for syntax highlighting
 */
export function getCodeLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    html: 'html',
    css: 'css',
    json: 'json',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return languageMap[ext] || 'plaintext';
}
