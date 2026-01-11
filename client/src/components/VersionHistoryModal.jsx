/**
 * Version History Modal
 * نافذة سجل الإصدارات
 */

import { useState, useEffect } from 'react';
import { FiX, FiClock, FiDownload, FiRotateCcw, FiTrash2, FiFile } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function VersionHistoryModal({ file, onClose, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    loadVersions();
  }, [file.id]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/versions/${file.id}`);
      setVersions(res.data.versions || []);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!confirm('هل أنت متأكد من استعادة هذا الإصدار؟ سيتم حفظ الإصدار الحالي تلقائياً.')) {
      return;
    }

    try {
      setRestoring(versionId);
      await axios.post(`${API}/versions/${file.id}/restore/${versionId}`);
      onRestore?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في استعادة الإصدار');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (versionId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإصدار؟')) {
      return;
    }

    try {
      await axios.delete(`${API}/versions/${versionId}`);
      setVersions(versions.filter(v => v.id !== versionId));
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف الإصدار');
    }
  };

  const handleDownload = async (version) => {
    try {
      const res = await axios.get(`${API}/versions/download/${version.id}`);
      // Use telegram file ID to download
      const link = document.createElement('a');
      link.href = `${API}/download-file/${file.id}?version=${version.id}`;
      link.download = `${version.name}_v${version.version_number}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('فشل في تحميل الإصدار');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal version-history-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <FiClock /> سجل الإصدارات
          </h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <div className="current-file-info">
            <FiFile />
            <span>{file.name}</span>
            <span className="file-size">{formatSize(file.size)}</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري تحميل الإصدارات...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="empty-state">
              <FiClock size={48} />
              <p>لا توجد إصدارات سابقة</p>
              <small>سيتم حفظ الإصدارات تلقائياً عند تحديث الملف</small>
            </div>
          ) : (
            <div className="versions-list">
              {versions.map((version, index) => (
                <div key={version.id} className="version-item">
                  <div className="version-info">
                    <div className="version-number">
                      الإصدار {version.version_number}
                      {index === 0 && <span className="latest-badge">الأحدث</span>}
                    </div>
                    <div className="version-meta">
                      <span>{formatDate(version.created_at)}</span>
                      <span className="separator">•</span>
                      <span>{formatSize(version.size)}</span>
                    </div>
                    {version.comment && (
                      <div className="version-comment">{version.comment}</div>
                    )}
                  </div>
                  <div className="version-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleDownload(version)}
                      title="تحميل"
                    >
                      <FiDownload />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleRestore(version.id)}
                      disabled={restoring === version.id}
                      title="استعادة"
                    >
                      {restoring === version.id ? (
                        <div className="spinner-small"></div>
                      ) : (
                        <FiRotateCcw />
                      )}
                    </button>
                    <button
                      className="btn-icon danger"
                      onClick={() => handleDelete(version.id)}
                      title="حذف"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <small>يتم حفظ آخر 10 إصدارات تلقائياً</small>
          <button className="btn secondary" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>

      <style>{`
        .version-history-modal {
          max-width: 600px;
          width: 95%;
        }

        .current-file-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .current-file-info .file-size {
          margin-right: auto;
          color: var(--text-secondary);
          font-size: 0.9em;
        }

        .versions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .version-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          transition: background 0.2s;
        }

        .version-item:hover {
          background: var(--bg-hover);
        }

        .version-info {
          flex: 1;
        }

        .version-number {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .latest-badge {
          font-size: 0.75em;
          padding: 2px 8px;
          background: var(--primary-color);
          color: white;
          border-radius: 12px;
          font-weight: normal;
        }

        .version-meta {
          font-size: 0.85em;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .version-meta .separator {
          margin: 0 6px;
        }

        .version-comment {
          font-size: 0.85em;
          color: var(--text-secondary);
          margin-top: 4px;
          font-style: italic;
        }

        .version-actions {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          padding: 8px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 6px;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: var(--bg-hover);
          color: var(--primary-color);
        }

        .btn-icon.danger:hover {
          color: #dc3545;
        }

        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border-color);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .empty-state svg {
          opacity: 0.5;
          margin-bottom: 16px;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-footer small {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
