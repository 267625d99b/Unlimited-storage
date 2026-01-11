import { memo, useCallback, useState } from 'react';
import { FiHardDrive, FiFolder, FiShare2, FiLink, FiCopy, FiInfo, FiEdit2 } from 'react-icons/fi';

// New Folder Modal
export const NewFolderModal = memo(function NewFolderModal({ 
  show, 
  folderName, 
  onNameChange, 
  onCreate, 
  onClose 
}) {
  if (!show) return null;

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') onCreate();
  }, [onCreate]);

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={stopPropagation}>
        <h3>مجلد جديد</h3>
        <input
          type="text"
          placeholder="اسم المجلد"
          value={folderName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyPress={handleKeyPress}
          maxLength={255}
          autoFocus
        />
        <div className="modal-actions">
          <button className="cancel" onClick={onClose}>إلغاء</button>
          <button className="confirm" onClick={onCreate}>إنشاء</button>
        </div>
      </div>
    </div>
  );
});

// Move/Copy Modal
export const MoveModal = memo(function MoveModal({ 
  moveModal, 
  allFolders, 
  onMove, 
  onCopy, 
  onClose 
}) {
  if (!moveModal) return null;

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);
  const handleAction = moveModal.action === 'move' ? onMove : onCopy;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal move-modal" onClick={stopPropagation}>
        <h3>{moveModal.action === 'move' ? 'نقل إلى' : 'نسخ إلى'}</h3>
        <p className="move-item-name">{moveModal.item.name}</p>
        
        <div className="folder-list">
          <button className="folder-option" onClick={() => handleAction(null)}>
            <FiHardDrive />
            <span>ملفاتي (الجذر)</span>
          </button>
          
          {allFolders
            .filter(f => f.id !== moveModal.item.id)
            .map(folder => (
              <button 
                key={folder.id}
                className="folder-option"
                onClick={() => handleAction(folder.id)}
              >
                <FiFolder />
                <span>{folder.name}</span>
              </button>
            ))
          }
        </div>
        
        <div className="modal-actions">
          <button className="cancel" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
});

// Share Modal
export const ShareModal = memo(function ShareModal({ 
  shareModal, 
  onRemoveShare, 
  onClose,
  onCopyLink 
}) {
  if (!shareModal) return null;

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);
  const shareUrl = `${window.location.origin}/share/${shareModal.shareId}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    onCopyLink();
  }, [shareUrl, onCopyLink]);

  const handleSelectAll = useCallback((e) => e.target.select(), []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={stopPropagation}>
        <h3><FiShare2 /> مشاركة الملف</h3>
        <p className="share-filename">{shareModal.file.name}</p>
        
        <div className="share-link-box">
          <FiLink />
          <input 
            type="text" 
            readOnly 
            value={shareUrl}
            onClick={handleSelectAll}
          />
          <button onClick={handleCopy}>
            <FiCopy />
          </button>
        </div>
        
        <div className="modal-actions">
          <button className="delete" onClick={() => onRemoveShare(shareModal.file.id)}>
            إلغاء المشاركة
          </button>
          <button className="cancel" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
});

// File Info Modal
export const FileInfoModal = memo(function FileInfoModal({ 
  file, 
  onClose,
  formatSize,
  formatDate 
}) {
  if (!file) return null;

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal info-modal" onClick={stopPropagation}>
        <h3><FiInfo /> معلومات الملف</h3>
        
        <div className="info-content">
          <div className="info-row">
            <span className="info-label">الاسم:</span>
            <span className="info-value">{file.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">الحجم:</span>
            <span className="info-value">{formatSize(file.size)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">النوع:</span>
            <span className="info-value">{file.type || 'غير معروف'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">تاريخ الإنشاء:</span>
            <span className="info-value">{formatDate(file.created_at)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">المفضلة:</span>
            <span className="info-value">{file.starred ? 'نعم ⭐' : 'لا'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">مشارك:</span>
            <span className="info-value">{file.shared ? 'نعم 🔗' : 'لا'}</span>
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="cancel" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
});

// Rename Modal
export const RenameModal = memo(function RenameModal({
  item,
  type,
  onRename,
  onClose
}) {
  const [newName, setNewName] = useState(item?.name || '');

  if (!item) return null;

  const handleSubmit = () => {
    if (newName.trim() && newName !== item.name) {
      onRename(type, item.id, newName.trim());
    }
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3><FiEdit2 /> إعادة تسمية</h3>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="الاسم الجديد"
          autoFocus
          maxLength={255}
        />
        <div className="modal-actions">
          <button className="cancel" onClick={onClose}>إلغاء</button>
          <button 
            className="confirm" 
            onClick={handleSubmit}
            disabled={!newName.trim() || newName === item.name}
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
});
