import { useState, useEffect, useCallback } from 'react';
import { FiX, FiTrash2, FiFile, FiCheck, FiAlertCircle, FiCopy, FiHardDrive } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

// Format bytes helper
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DuplicatesModal({ onClose, onDeleted }) {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [data, setData] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Load duplicates
  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/duplicates`);
      setData(res.data);
      // Auto-expand first 3 groups
      const firstGroups = res.data.groups.slice(0, 3).map((_, i) => i);
      setExpandedGroups(new Set(firstGroups));
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  // Toggle file selection
  const toggleFile = (fileId) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all duplicates in a group
  const selectAllInGroup = (group) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      group.duplicates.forEach(f => newSet.add(f.id));
      return newSet;
    });
  };

  // Select all duplicates
  const selectAllDuplicates = () => {
    if (!data) return;
    const allDuplicateIds = data.groups.flatMap(g => g.duplicates.map(f => f.id));
    setSelectedFiles(new Set(allDuplicateIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Delete selected files
  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`هل أنت متأكد من حذف ${selectedFiles.size} ملف مكرر؟`)) return;
    
    setDeleting(true);
    try {
      const res = await axios.delete(`${API}/duplicates`, {
        data: { fileIds: Array.from(selectedFiles) }
      });
      
      alert(res.data.message);
      setSelectedFiles(new Set());
      loadDuplicates();
      if (onDeleted) onDeleted();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف الملفات');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle group expansion
  const toggleGroup = (index) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calculate selected size
  const selectedSize = data?.groups
    .flatMap(g => g.duplicates)
    .filter(f => selectedFiles.has(f.id))
    .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal duplicates-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiCopy /> كشف الملفات المكررة</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري البحث عن الملفات المكررة...</p>
            </div>
          ) : !data || data.totalGroups === 0 ? (
            <div className="empty-state">
              <FiCheck size={48} />
              <h3>لا توجد ملفات مكررة! 🎉</h3>
              <p>ملفاتك منظمة بشكل ممتاز</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="duplicates-summary">
                <div className="summary-card">
                  <FiAlertCircle />
                  <div>
                    <span className="value">{data.totalGroups}</span>
                    <span className="label">مجموعة مكررة</span>
                  </div>
                </div>
                <div className="summary-card">
                  <FiFile />
                  <div>
                    <span className="value">{data.totalDuplicateFiles}</span>
                    <span className="label">ملف مكرر</span>
                  </div>
                </div>
                <div className="summary-card warning">
                  <FiHardDrive />
                  <div>
                    <span className="value">{formatSize(data.totalWastedSpace)}</span>
                    <span className="label">مساحة مهدرة</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="duplicates-actions">
                <button onClick={selectAllDuplicates} className="btn-secondary">
                  تحديد كل المكررات ({data.totalDuplicateFiles})
                </button>
                {selectedFiles.size > 0 && (
                  <>
                    <button onClick={clearSelection} className="btn-secondary">
                      إلغاء التحديد
                    </button>
                    <button 
                      onClick={deleteSelected} 
                      className="btn-danger"
                      disabled={deleting}
                    >
                      <FiTrash2 />
                      {deleting ? 'جاري الحذف...' : `حذف ${selectedFiles.size} ملف (${formatSize(selectedSize)})`}
                    </button>
                  </>
                )}
              </div>

              {/* Groups */}
              <div className="duplicates-groups">
                {data.groups.map((group, index) => (
                  <div key={index} className={`duplicate-group ${group.type}`}>
                    <div 
                      className="group-header"
                      onClick={() => toggleGroup(index)}
                    >
                      <div className="group-info">
                        <span className={`type-badge ${group.type}`}>
                          {group.type === 'exact' ? 'تطابق تام' : 'تشابه'}
                        </span>
                        <span className="group-reason">{group.reason}</span>
                      </div>
                      <div className="group-stats">
                        <span>{group.fileCount} ملفات</span>
                        <span className="wasted">{formatSize(group.wastedSpace)} مهدرة</span>
                        <span className="expand-icon">{expandedGroups.has(index) ? '▼' : '▶'}</span>
                      </div>
                    </div>

                    {expandedGroups.has(index) && (
                      <div className="group-files">
                        {/* Original file */}
                        <div className="file-item original">
                          <div className="file-checkbox">
                            <span className="original-badge">الأصلي</span>
                          </div>
                          <div className="file-info">
                            <span className="file-name">{group.originalFile.name}</span>
                            <span className="file-meta">
                              {formatSize(group.originalFile.size)} • 
                              {new Date(group.originalFile.created_at).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                        </div>

                        {/* Duplicate files */}
                        {group.duplicates.map(file => (
                          <div 
                            key={file.id} 
                            className={`file-item duplicate ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                            onClick={() => toggleFile(file.id)}
                          >
                            <div className="file-checkbox">
                              <input 
                                type="checkbox" 
                                checked={selectedFiles.has(file.id)}
                                onChange={() => toggleFile(file.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                            <div className="file-info">
                              <span className="file-name">{file.name}</span>
                              <span className="file-meta">
                                {formatSize(file.size)} • 
                                {new Date(file.created_at).toLocaleDateString('ar-SA')}
                              </span>
                            </div>
                          </div>
                        ))}

                        <button 
                          className="select-group-btn"
                          onClick={() => selectAllInGroup(group)}
                        >
                          تحديد كل المكررات في هذه المجموعة
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
