import { memo, useCallback, useMemo, useState } from 'react';
import { FiFolder, FiFile, FiImage, FiVideo, FiMusic, FiFileText, FiMoreVertical } from 'react-icons/fi';

// Get file type info (icon, color, label) - checks both MIME type and extension
const getFileTypeInfo = (type, name) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  const mimeType = type?.toLowerCase() || '';
  
  // Images
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return { icon: <FiImage />, color: '#ea4335', label: ext?.toUpperCase() || 'IMG', bg: '#fce8e6' };
  }
  // Videos
  if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'].includes(ext)) {
    return { icon: <FiVideo />, color: '#4285f4', label: ext?.toUpperCase() || 'VID', bg: '#e8f0fe' };
  }
  // Audio
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
    return { icon: <FiMusic />, color: '#fbbc04', label: ext?.toUpperCase() || 'AUD', bg: '#fef7e0' };
  }
  // PDF
  if (mimeType.includes('pdf') || ext === 'pdf') {
    return { icon: <FiFileText />, color: '#ea4335', label: 'PDF', bg: '#fce8e6' };
  }
  // Word documents
  if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return { icon: <FiFileText />, color: '#4285f4', label: ext?.toUpperCase() || 'DOC', bg: '#e8f0fe' };
  }
  // Excel/Spreadsheets
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return { icon: <FiFileText />, color: '#34a853', label: ext?.toUpperCase() || 'XLS', bg: '#e6f4ea' };
  }
  // PowerPoint/Presentations
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || ['ppt', 'pptx', 'odp'].includes(ext)) {
    return { icon: <FiFileText />, color: '#ff6d01', label: ext?.toUpperCase() || 'PPT', bg: '#fee8d6' };
  }
  // Text/Code files
  if (mimeType.includes('text') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h'].includes(ext)) {
    return { icon: <FiFileText />, color: '#5f6368', label: ext?.toUpperCase() || 'TXT', bg: '#f1f3f4' };
  }
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return { icon: <FiFile />, color: '#9334e6', label: ext?.toUpperCase() || 'ZIP', bg: '#f3e8fd' };
  }
  // Default
  return { icon: <FiFile />, color: '#5f6368', label: ext?.toUpperCase() || 'FILE', bg: '#f1f3f4' };
};

// Format file size
const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Folder Item Component with Drag & Drop
export const FolderItem = memo(function FolderItem({ 
  folder, 
  isSelected, 
  onClick, 
  onDoubleClick, 
  onContextMenu,
  onDrop // New prop for handling drops
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = useCallback((e) => onClick(e, folder, 'folder'), [onClick, folder]);
  const handleDoubleClick = useCallback(() => onDoubleClick(folder), [onDoubleClick, folder]);
  const handleContextMenu = useCallback((e) => onContextMenu(e, folder, 'folder'), [onContextMenu, folder]);
  const handleMoreClick = useCallback((e) => {
    e.stopPropagation();
    onContextMenu(e, folder, 'folder');
  }, [onContextMenu, folder]);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id, name: folder.name }));
    e.dataTransfer.effectAllowed = 'move';
  }, [folder]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDropOnFolder = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.id !== folder.id && onDrop) {
        onDrop(data, folder.id);
      }
    } catch (err) {
      // Drop error handled
    }
  }, [folder.id, onDrop]);

  return (
    <div
      className={`file-item folder ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropOnFolder}
      role="button"
      tabIndex={0}
      aria-label={`مجلد ${folder.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter') handleDoubleClick(); }}
    >
      <div className="file-icon folder-icon">
        <FiFolder aria-hidden="true" />
      </div>
      <div className="file-info">
        <span className="file-name">{folder.name}</span>
        <span className="file-meta">مجلد</span>
      </div>
      <button 
        className="more-btn" 
        onClick={handleMoreClick}
        aria-label={`خيارات المجلد ${folder.name}`}
      >
        <FiMoreVertical aria-hidden="true" />
      </button>
    </div>
  );
});


// Highlight search query in text
const HighlightText = memo(function HighlightText({ text, query }) {
  if (!query || !text) return text;
  
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i} className="search-highlight">{part}</mark>
      : part
  );
});

// File Item Component with Drag & Drop
export const FileItemComponent = memo(function FileItemComponent({ 
  file, 
  isSelected, 
  thumbnail,
  searchQuery,
  onClick, 
  onDoubleClick, 
  onContextMenu,
  onDrop // New prop for handling drops
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback((e) => onClick(e, file, 'file'), [onClick, file]);
  const handleDoubleClick = useCallback(() => onDoubleClick(file), [onDoubleClick, file]);
  const handleContextMenu = useCallback((e) => onContextMenu(e, file, 'file'), [onContextMenu, file]);
  const handleMoreClick = useCallback((e) => {
    e.stopPropagation();
    onContextMenu(e, file, 'file');
  }, [onContextMenu, file]);

  // Drag handlers
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id, name: file.name }));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  }, [file]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const fileTypeInfo = useMemo(() => getFileTypeInfo(file.type, file.name), [file.type, file.name]);
  const hasThumbnail = thumbnail && (file.type?.startsWith('image/') || file.type?.startsWith('video/'));
  const formattedSize = useMemo(() => formatSize(file.size), [file.size]);

  const className = useMemo(() => {
    let cls = 'file-item';
    if (isSelected) cls += ' selected';
    if (file.starred) cls += ' starred';
    if (file.shared) cls += ' shared';
    if (isDragging) cls += ' drag-source';
    return cls;
  }, [isSelected, file.starred, file.shared, isDragging]);

  return (
    <div
      className={className}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      role="button"
      tabIndex={0}
      aria-label={`ملف ${file.name}, ${formattedSize}`}
      onKeyDown={(e) => { if (e.key === 'Enter') handleDoubleClick(); }}
    >
      <div className="file-preview-box" style={{ backgroundColor: fileTypeInfo.bg }}>
        {hasThumbnail ? (
          <>
            <img src={thumbnail} alt={file.name} className="thumbnail-img" loading="lazy" />
            {file.type?.startsWith('video/') && (
              <div className="video-badge" aria-label="فيديو"><FiVideo aria-hidden="true" /></div>
            )}
          </>
        ) : (
          <div className="file-type-icon" style={{ color: fileTypeInfo.color }}>
            {fileTypeInfo.icon}
          </div>
        )}
        <span className="file-type-badge" style={{ backgroundColor: fileTypeInfo.color }} aria-hidden="true">
          {fileTypeInfo.label}
        </span>
      </div>
      <div className="file-info">
        <span className="file-name">
          {searchQuery ? <HighlightText text={file.name} query={searchQuery} /> : file.name}
        </span>
        <span className="file-meta">{formattedSize}</span>
      </div>
      <button 
        className="more-btn" 
        onClick={handleMoreClick}
        aria-label={`خيارات الملف ${file.name}`}
      >
        <FiMoreVertical aria-hidden="true" />
      </button>
    </div>
  );
});

export { getFileTypeInfo, formatSize, HighlightText };
