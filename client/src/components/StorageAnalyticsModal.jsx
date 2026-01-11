import { useState, useEffect, useCallback } from 'react';
import { 
  FiX, FiHardDrive, FiTrash2, FiFile, FiFolder, 
  FiImage, FiVideo, FiMusic, FiFileText, FiArchive, FiAlertCircle 
} from 'react-icons/fi';
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

// Get icon for category
const getCategoryIcon = (category) => {
  const icons = {
    images: FiImage,
    videos: FiVideo,
    audio: FiMusic,
    pdf: FiFileText,
    documents: FiFileText,
    spreadsheets: FiFileText,
    presentations: FiFileText,
    archives: FiArchive,
    text: FiFileText,
    other: FiFile
  };
  return icons[category] || FiFile;
};

export default function StorageAnalyticsModal({ onClose, onCleanup }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [cleaning, setCleaning] = useState(false);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/storage/analytics`);
      setData(res.data);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

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

  // Select all unused files
  const selectAllUnused = () => {
    if (!data?.unusedFiles) return;
    setSelectedFiles(new Set(data.unusedFiles.map(f => f.id)));
  };

  // Clean selected files
  const cleanSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`هل أنت متأكد من حذف ${selectedFiles.size} ملف؟`)) return;
    
    setCleaning(true);
    try {
      const res = await axios.delete(`${API}/storage/cleanup`, {
        data: { fileIds: Array.from(selectedFiles) }
      });
      
      alert(res.data.message);
      setSelectedFiles(new Set());
      loadAnalytics();
      if (onCleanup) onCleanup();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف الملفات');
    } finally {
      setCleaning(false);
    }
  };

  // Calculate selected size
  const selectedSize = data?.unusedFiles
    ?.filter(f => selectedFiles.has(f.id))
    .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal storage-analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiHardDrive /> تحليل التخزين</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري تحليل التخزين...</p>
            </div>
          ) : !data ? (
            <div className="empty-state">
              <FiAlertCircle size={48} />
              <p>فشل في تحميل البيانات</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="analytics-tabs">
                <button 
                  className={activeTab === 'overview' ? 'active' : ''}
                  onClick={() => setActiveTab('overview')}
                >
                  نظرة عامة
                </button>
                <button 
                  className={activeTab === 'largest' ? 'active' : ''}
                  onClick={() => setActiveTab('largest')}
                >
                  أكبر الملفات
                </button>
                <button 
                  className={activeTab === 'unused' ? 'active' : ''}
                  onClick={() => setActiveTab('unused')}
                >
                  غير مستخدمة
                </button>
                <button 
                  className={activeTab === 'folders' ? 'active' : ''}
                  onClick={() => setActiveTab('folders')}
                >
                  حسب المجلد
                </button>
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="analytics-overview">
                  {/* Total Storage */}
                  <div className="total-storage">
                    <FiHardDrive size={32} />
                    <div>
                      <span className="total-size">{formatSize(data.analytics.totalSize)}</span>
                      <span className="total-label">إجمالي التخزين ({data.analytics.totalFiles} ملف)</span>
                    </div>
                  </div>

                  {/* Pie Chart (CSS-based) */}
                  <div className="storage-chart">
                    <div className="pie-chart">
                      {data.analytics.distribution.map((item, index) => {
                        const prevPercentage = data.analytics.distribution
                          .slice(0, index)
                          .reduce((sum, d) => sum + d.percentage, 0);
                        return (
                          <div 
                            key={item.category}
                            className="pie-segment"
                            style={{
                              '--percentage': item.percentage,
                              '--offset': prevPercentage,
                              '--color': item.color
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Distribution List */}
                  <div className="distribution-list">
                    {data.analytics.distribution.map(item => {
                      const Icon = getCategoryIcon(item.category);
                      return (
                        <div key={item.category} className="distribution-item">
                          <div className="item-info">
                            <span className="item-color" style={{ background: item.color }}></span>
                            <Icon />
                            <span className="item-label">{item.label}</span>
                          </div>
                          <div className="item-stats">
                            <span className="item-count">{item.count} ملف</span>
                            <span className="item-size">{formatSize(item.totalSize)}</span>
                            <span className="item-percentage">{item.percentage}%</span>
                          </div>
                          <div className="item-bar">
                            <div 
                              className="item-bar-fill" 
                              style={{ width: `${item.percentage}%`, background: item.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Largest Files Tab */}
              {activeTab === 'largest' && (
                <div className="analytics-list">
                  <h3>أكبر 10 ملفات</h3>
                  {data.largestFiles.map((file, index) => (
                    <div key={file.id} className="file-row">
                      <span className="file-rank">#{index + 1}</span>
                      <FiFile />
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Unused Files Tab */}
              {activeTab === 'unused' && (
                <div className="analytics-list">
                  <div className="unused-header">
                    <h3>ملفات لم تُستخدم منذ 30 يوم ({data.unusedFiles.length})</h3>
                    <div className="unused-actions">
                      <button onClick={selectAllUnused} className="btn-secondary">
                        تحديد الكل
                      </button>
                      {selectedFiles.size > 0 && (
                        <button 
                          onClick={cleanSelected} 
                          className="btn-danger"
                          disabled={cleaning}
                        >
                          <FiTrash2 />
                          {cleaning ? 'جاري الحذف...' : `حذف ${selectedFiles.size} (${formatSize(selectedSize)})`}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {data.unusedFiles.length === 0 ? (
                    <div className="empty-message">
                      <p>🎉 لا توجد ملفات غير مستخدمة!</p>
                    </div>
                  ) : (
                    data.unusedFiles.map(file => (
                      <div 
                        key={file.id} 
                        className={`file-row selectable ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                        onClick={() => toggleFile(file.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFile(file.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <FiFile />
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatSize(file.size)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* By Folder Tab */}
              {activeTab === 'folders' && (
                <div className="analytics-list">
                  <h3>التخزين حسب المجلد</h3>
                  {data.byFolder.map(folder => (
                    <div key={folder.folder_id} className="folder-row">
                      <FiFolder />
                      <span className="folder-name">{folder.folder_name}</span>
                      <span className="folder-count">{folder.file_count} ملف</span>
                      <span className="folder-size">{formatSize(folder.total_size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
