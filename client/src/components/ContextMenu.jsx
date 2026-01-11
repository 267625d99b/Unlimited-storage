import { memo, useCallback } from 'react';
import { 
  FiEye, FiDownload, FiShare2, FiStar, FiInfo, 
  FiMove, FiCopy, FiEdit2, FiTrash2, FiClock,
  FiMessageSquare, FiPackage, FiTag
} from 'react-icons/fi';

const ContextMenu = memo(function ContextMenu({ 
  contextMenu, 
  onPreview,
  onDownload,
  onShare,
  onToggleStar,
  onShowInfo,
  onMove,
  onCopy,
  onRename,
  onDelete,
  onVersionHistory,
  onComments,
  onAddToCollection,
  onManageTags,
  onClose
}) {
  if (!contextMenu) return null;

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);
  const { item, type, x, y } = contextMenu;

  const handlePreview = useCallback(() => {
    onPreview(item);
    onClose();
  }, [onPreview, item, onClose]);

  const handleDownload = useCallback(() => {
    onDownload(item);
    onClose();
  }, [onDownload, item, onClose]);

  const handleShare = useCallback(() => {
    onShare(item);
  }, [onShare, item]);

  const handleStar = useCallback(() => {
    onToggleStar(item);
  }, [onToggleStar, item]);

  const handleInfo = useCallback(() => {
    onShowInfo(item);
  }, [onShowInfo, item]);

  const handleMove = useCallback(() => {
    onMove(item, type, 'move');
  }, [onMove, item, type]);

  const handleCopy = useCallback(() => {
    onCopy(item, type, 'copy');
  }, [onCopy, item, type]);

  const handleRename = useCallback(() => {
    onRename(item, type);
  }, [onRename, item, type]);

  const handleDelete = useCallback(() => {
    onDelete(type, item.id);
  }, [onDelete, type, item.id]);

  const handleVersionHistory = useCallback(() => {
    onVersionHistory?.(item);
    onClose();
  }, [onVersionHistory, item, onClose]);

  const handleComments = useCallback(() => {
    onComments?.(item);
    onClose();
  }, [onComments, item, onClose]);

  const handleAddToCollection = useCallback(() => {
    onAddToCollection?.(item);
    onClose();
  }, [onAddToCollection, item, onClose]);

  const handleManageTags = useCallback(() => {
    onManageTags?.(item);
    onClose();
  }, [onManageTags, item, onClose]);

  return (
    <div 
      className="context-menu" 
      style={{ top: y, left: x }}
      onClick={stopPropagation}
    >
      {type === 'file' && (
        <>
          <button onClick={handlePreview}>
            <FiEye /> معاينة
          </button>
          <button onClick={handleDownload}>
            <FiDownload /> تحميل
          </button>
          <div className="context-menu-divider" />
          <button onClick={handleShare}>
            <FiShare2 /> {item.shared ? 'إدارة المشاركة' : 'مشاركة'}
          </button>
          <button onClick={handleStar}>
            <FiStar /> {item.starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
          </button>
          <button onClick={handleAddToCollection}>
            <FiPackage /> إضافة لمجموعة
          </button>
          <button onClick={handleManageTags}>
            <FiTag /> إدارة الوسوم
          </button>
          <div className="context-menu-divider" />
          <button onClick={handleVersionHistory}>
            <FiClock /> سجل الإصدارات
          </button>
          <button onClick={handleComments}>
            <FiMessageSquare /> التعليقات
          </button>
          <button onClick={handleInfo}>
            <FiInfo /> معلومات الملف
          </button>
          <div className="context-menu-divider" />
        </>
      )}
      <button onClick={handleMove}>
        <FiMove /> نقل إلى
      </button>
      {type === 'file' && (
        <button onClick={handleCopy}>
          <FiCopy /> نسخ إلى
        </button>
      )}
      <button onClick={handleRename}>
        <FiEdit2 /> إعادة تسمية
      </button>
      <button className="delete" onClick={handleDelete}>
        <FiTrash2 /> نقل للمحذوفات
      </button>
    </div>
  );
});

export default ContextMenu;
