import { useState, useEffect, useCallback } from 'react';
import { FiX, FiTag, FiPlus, FiEdit2, FiTrash2, FiCheck } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

// Predefined colors
const TAG_COLORS = [
  '#1a73e8', '#ea4335', '#fbbc04', '#34a853', '#ff5722',
  '#9c27b0', '#00bcd4', '#ff9800', '#795548', '#607d8b'
];

export default function TagsManager({ onClose, onTagSelect }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tags`);
      setTags(res.data.tags || []);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Create tag
  const createTag = async () => {
    if (!newTagName.trim()) return;
    
    setSaving(true);
    try {
      const res = await axios.post(`${API}/tags`, {
        name: newTagName.trim(),
        color: newTagColor
      });
      
      setTags(prev => [...prev, res.data.tag]);
      setNewTagName('');
      setShowCreate(false);
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إنشاء الوسم');
    } finally {
      setSaving(false);
    }
  };

  // Update tag
  const updateTag = async () => {
    if (!editingTag || !newTagName.trim()) return;
    
    setSaving(true);
    try {
      const res = await axios.patch(`${API}/tags/${editingTag.id}`, {
        name: newTagName.trim(),
        color: newTagColor
      });
      
      setTags(prev => prev.map(t => t.id === editingTag.id ? res.data.tag : t));
      setEditingTag(null);
      setNewTagName('');
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تحديث الوسم');
    } finally {
      setSaving(false);
    }
  };

  // Delete tag
  const deleteTag = async (tagId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الوسم؟')) return;
    
    try {
      await axios.delete(`${API}/tags/${tagId}`);
      setTags(prev => prev.filter(t => t.id !== tagId));
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف الوسم');
    }
  };

  // Start editing
  const startEdit = (tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setShowCreate(false);
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingTag(null);
    setNewTagName('');
    setShowCreate(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tags-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiTag /> إدارة الوسوم</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          {/* Create/Edit Form */}
          {(showCreate || editingTag) && (
            <div className="tag-form">
              <input
                type="text"
                placeholder="اسم الوسم..."
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                maxLength={50}
                autoFocus
              />
              
              <div className="color-picker">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    className={`color-option ${newTagColor === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
              
              <div className="form-actions">
                <button onClick={cancelEdit} className="btn-secondary">إلغاء</button>
                <button 
                  onClick={editingTag ? updateTag : createTag} 
                  className="btn-primary"
                  disabled={saving || !newTagName.trim()}
                >
                  {saving ? 'جاري الحفظ...' : (editingTag ? 'تحديث' : 'إنشاء')}
                </button>
              </div>
            </div>
          )}

          {/* Add Button */}
          {!showCreate && !editingTag && (
            <button className="add-tag-btn" onClick={() => setShowCreate(true)}>
              <FiPlus /> إضافة وسم جديد
            </button>
          )}

          {/* Tags List */}
          <div className="tags-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
              </div>
            ) : tags.length === 0 ? (
              <div className="empty-state">
                <FiTag size={48} />
                <p>لا توجد وسوم بعد</p>
                <p className="hint">أنشئ وسوماً لتنظيم ملفاتك</p>
              </div>
            ) : (
              tags.map(tag => (
                <div key={tag.id} className="tag-item">
                  <div 
                    className="tag-info"
                    onClick={() => onTagSelect && onTagSelect(tag)}
                    style={{ cursor: onTagSelect ? 'pointer' : 'default' }}
                  >
                    <span className="tag-color" style={{ background: tag.color }}></span>
                    <span className="tag-name">{tag.name}</span>
                    <span className="tag-count">{tag.file_count || 0} ملف</span>
                  </div>
                  <div className="tag-actions">
                    <button onClick={() => startEdit(tag)} title="تعديل">
                      <FiEdit2 />
                    </button>
                    <button onClick={() => deleteTag(tag.id)} title="حذف" className="danger">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tag selector component for file tagging
export function TagSelector({ fileId, onClose }) {
  const [tags, setTags] = useState([]);
  const [fileTags, setFileTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tagsRes, fileTagsRes] = await Promise.all([
          axios.get(`${API}/tags`),
          axios.get(`${API}/files/${fileId}/tags`)
        ]);
        setTags(tagsRes.data.tags || []);
        setFileTags(fileTagsRes.data.tags || []);
      } catch (err) {
        // Error handled by UI
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fileId]);

  const toggleTag = async (tag) => {
    const isTagged = fileTags.some(t => t.id === tag.id);
    
    try {
      if (isTagged) {
        await axios.delete(`${API}/files/${fileId}/tags/${tag.id}`);
        setFileTags(prev => prev.filter(t => t.id !== tag.id));
      } else {
        await axios.post(`${API}/files/${fileId}/tags`, { tagId: tag.id });
        setFileTags(prev => [...prev, tag]);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تحديث الوسوم');
    }
  };

  return (
    <div className="tag-selector-dropdown">
      <div className="dropdown-header">
        <span>الوسوم</span>
        <button onClick={onClose}><FiX /></button>
      </div>
      
      {loading ? (
        <div className="loading-small"><div className="spinner-small"></div></div>
      ) : tags.length === 0 ? (
        <div className="no-tags">لا توجد وسوم</div>
      ) : (
        <div className="tag-options">
          {tags.map(tag => {
            const isTagged = fileTags.some(t => t.id === tag.id);
            return (
              <div 
                key={tag.id} 
                className={`tag-option ${isTagged ? 'selected' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                <span className="tag-color" style={{ background: tag.color }}></span>
                <span className="tag-name">{tag.name}</span>
                {isTagged && <FiCheck />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Display tags on file
export function FileTags({ tags }) {
  if (!tags || tags.length === 0) return null;
  
  return (
    <div className="file-tags-display">
      {tags.slice(0, 3).map(tag => (
        <span 
          key={tag.id} 
          className="file-tag"
          style={{ background: tag.color + '20', color: tag.color, borderColor: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="more-tags">+{tags.length - 3}</span>
      )}
    </div>
  );
}
