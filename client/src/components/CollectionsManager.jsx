/**
 * Collections Manager Component
 * مكون إدارة المجموعات
 */

import { useState, useEffect } from 'react';
import {
  FiFolder, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck,
  FiFile, FiChevronLeft, FiPackage
} from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

const COLORS = [
  '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0',
  '#00bcd4', '#ff5722', '#607d8b', '#e91e63', '#3f51b5'
];

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function CollectionsManager({ onClose, onSelectCollection }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionFiles, setCollectionFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/collections`);
      setCollections(res.data.collections || []);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionFiles = async (collectionId) => {
    try {
      setLoadingFiles(true);
      const res = await axios.get(`${API}/collections/${collectionId}`);
      setCollectionFiles(res.data.files || []);
      setSelectedCollection(res.data.collection);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await axios.post(`${API}/collections`, {
        name: name.trim(),
        description: description.trim(),
        color
      });
      setName('');
      setDescription('');
      setColor(COLORS[0]);
      setShowCreate(false);
      loadCollections();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إنشاء المجموعة');
    }
  };

  const handleUpdate = async (id) => {
    if (!name.trim()) return;

    try {
      await axios.patch(`${API}/collections/${id}`, {
        name: name.trim(),
        description: description.trim(),
        color
      });
      setEditingId(null);
      setName('');
      setDescription('');
      loadCollections();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تحديث المجموعة');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه المجموعة؟')) return;

    try {
      await axios.delete(`${API}/collections/${id}`);
      loadCollections();
      if (selectedCollection?.id === id) {
        setSelectedCollection(null);
        setCollectionFiles([]);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف المجموعة');
    }
  };

  const handleRemoveFile = async (fileId) => {
    if (!selectedCollection) return;

    try {
      await axios.delete(`${API}/collections/${selectedCollection.id}/files/${fileId}`);
      setCollectionFiles(collectionFiles.filter(f => f.id !== fileId));
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إزالة الملف');
    }
  };

  const startEdit = (collection) => {
    setEditingId(collection.id);
    setName(collection.name);
    setDescription(collection.description || '');
    setColor(collection.color || COLORS[0]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setColor(COLORS[0]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal collections-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {selectedCollection ? (
              <>
                <button className="back-btn" onClick={() => {
                  setSelectedCollection(null);
                  setCollectionFiles([]);
                }}>
                  <FiChevronLeft />
                </button>
                <span style={{ color: selectedCollection.color }}>
                  <FiPackage />
                </span>
                {selectedCollection.name}
              </>
            ) : (
              <>
                <FiPackage /> المجموعات
              </>
            )}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {selectedCollection ? (
            // Collection Files View
            <div className="collection-files">
              {selectedCollection.description && (
                <p className="collection-description">{selectedCollection.description}</p>
              )}
              
              {loadingFiles ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                </div>
              ) : collectionFiles.length === 0 ? (
                <div className="empty-state">
                  <FiFile size={48} />
                  <p>لا توجد ملفات في هذه المجموعة</p>
                </div>
              ) : (
                <div className="files-list">
                  {collectionFiles.map(file => (
                    <div key={file.id} className="file-item">
                      <FiFile />
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatSize(file.size)}</span>
                      </div>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveFile(file.id)}
                        title="إزالة من المجموعة"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Collections List View
            <>
              {/* Create Form */}
              {showCreate && (
                <div className="collection-form">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="اسم المجموعة"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="الوصف (اختياري)"
                  />
                  <div className="color-picker">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        className={`color-btn ${color === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                  <div className="form-actions">
                    <button onClick={handleCreate} disabled={!name.trim()}>
                      <FiCheck /> إنشاء
                    </button>
                    <button onClick={() => setShowCreate(false)} className="cancel">
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Collections List */}
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>جاري تحميل المجموعات...</p>
                </div>
              ) : collections.length === 0 && !showCreate ? (
                <div className="empty-state">
                  <FiPackage size={48} />
                  <p>لا توجد مجموعات</p>
                  <button onClick={() => setShowCreate(true)}>
                    <FiPlus /> إنشاء مجموعة
                  </button>
                </div>
              ) : (
                <div className="collections-list">
                  {collections.map(collection => (
                    <div key={collection.id} className="collection-item">
                      {editingId === collection.id ? (
                        <div className="collection-form inline">
                          <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                          />
                          <div className="color-picker small">
                            {COLORS.map(c => (
                              <button
                                key={c}
                                className={`color-btn ${color === c ? 'selected' : ''}`}
                                style={{ background: c }}
                                onClick={() => setColor(c)}
                              />
                            ))}
                          </div>
                          <div className="form-actions">
                            <button onClick={() => handleUpdate(collection.id)}>
                              <FiCheck />
                            </button>
                            <button onClick={cancelEdit} className="cancel">
                              <FiX />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className="collection-info"
                            onClick={() => loadCollectionFiles(collection.id)}
                          >
                            <span
                              className="collection-icon"
                              style={{ color: collection.color }}
                            >
                              <FiPackage />
                            </span>
                            <div className="collection-details">
                              <span className="collection-name">{collection.name}</span>
                              <span className="collection-count">
                                {collection.itemCount} ملف
                              </span>
                            </div>
                          </div>
                          <div className="collection-actions">
                            <button onClick={() => startEdit(collection)}>
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => handleDelete(collection.id)}
                              className="danger"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!selectedCollection && !showCreate && collections.length > 0 && (
          <div className="modal-footer">
            <button className="btn primary" onClick={() => setShowCreate(true)}>
              <FiPlus /> مجموعة جديدة
            </button>
          </div>
        )}
      </div>

      <style>{`
        .collections-modal {
          max-width: 500px;
          width: 95%;
        }

        .back-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin-left: 8px;
          color: var(--text-primary);
        }

        .collection-form {
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .collection-form.inline {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          padding: 8px;
        }

        .collection-form input {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .collection-form.inline input {
          flex: 1;
          margin-bottom: 0;
        }

        .color-picker {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .color-picker.small {
          margin-bottom: 0;
        }

        .color-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .color-btn.selected {
          border-color: var(--text-primary);
          transform: scale(1.2);
        }

        .form-actions {
          display: flex;
          gap: 8px;
        }

        .form-actions button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .form-actions button:first-child {
          background: var(--primary-color);
          color: white;
        }

        .form-actions button.cancel {
          background: var(--bg-hover);
        }

        .collections-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .collection-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          transition: background 0.2s;
        }

        .collection-item:hover {
          background: var(--bg-hover);
        }

        .collection-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          cursor: pointer;
        }

        .collection-icon {
          font-size: 1.5em;
        }

        .collection-details {
          display: flex;
          flex-direction: column;
        }

        .collection-name {
          font-weight: 500;
        }

        .collection-count {
          font-size: 0.85em;
          color: var(--text-secondary);
        }

        .collection-actions {
          display: flex;
          gap: 4px;
        }

        .collection-actions button {
          padding: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 6px;
          color: var(--text-secondary);
        }

        .collection-actions button:hover {
          background: var(--bg-hover);
          color: var(--primary-color);
        }

        .collection-actions button.danger:hover {
          color: #dc3545;
        }

        .collection-description {
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 16px;
          color: var(--text-secondary);
        }

        .files-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
        }

        .file-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .file-name {
          font-weight: 500;
        }

        .file-size {
          font-size: 0.85em;
          color: var(--text-secondary);
        }

        .remove-btn {
          padding: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          border-radius: 4px;
        }

        .remove-btn:hover {
          background: var(--bg-hover);
          color: #dc3545;
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

        .empty-state button {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
