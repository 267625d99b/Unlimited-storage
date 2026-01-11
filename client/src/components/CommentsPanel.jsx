/**
 * Comments Panel Component
 * مكون لوحة التعليقات
 */

import { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiSend, FiEdit2, FiTrash2, FiCornerDownRight, FiX } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
  if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
  if (diff < 604800000) return `منذ ${Math.floor(diff / 86400000)} يوم`;
  
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function Comment({ comment, currentUserId, onReply, onEdit, onDelete, depth = 0 }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setShowReplyInput(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setSubmitting(true);
    try {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = comment.user_id === currentUserId;

  return (
    <div className={`comment ${depth > 0 ? 'reply' : ''}`} style={{ marginRight: depth * 24 }}>
      <div className="comment-header">
        <span className="comment-author">{comment.user_id?.substring(0, 8) || 'مستخدم'}</span>
        <span className="comment-date">{formatDate(comment.created_at)}</span>
        {comment.updated_at !== comment.created_at && (
          <span className="comment-edited">(معدّل)</span>
        )}
      </div>

      {isEditing ? (
        <div className="comment-edit">
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={2}
            autoFocus
          />
          <div className="edit-actions">
            <button onClick={handleEdit} disabled={submitting}>
              {submitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setIsEditing(false)} className="cancel">
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="comment-content">{comment.content}</div>
      )}

      <div className="comment-actions">
        {depth < 2 && (
          <button onClick={() => setShowReplyInput(!showReplyInput)}>
            <FiCornerDownRight /> رد
          </button>
        )}
        {isOwner && (
          <>
            <button onClick={() => setIsEditing(true)}>
              <FiEdit2 /> تعديل
            </button>
            <button onClick={() => onDelete(comment.id)} className="danger">
              <FiTrash2 /> حذف
            </button>
          </>
        )}
      </div>

      {showReplyInput && (
        <div className="reply-input">
          <textarea
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            placeholder="اكتب ردك..."
            rows={2}
            autoFocus
          />
          <div className="reply-actions">
            <button onClick={handleReply} disabled={submitting || !replyContent.trim()}>
              <FiSend /> {submitting ? 'جاري الإرسال...' : 'إرسال'}
            </button>
            <button onClick={() => setShowReplyInput(false)} className="cancel">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <Comment
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentsPanel({ fileId, currentUserId, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    loadComments();
  }, [fileId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/comments/${fileId}`);
      setComments(res.data.comments || []);
      setCount(res.data.count || 0);
    } catch (err) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(`${API}/comments/${fileId}`, {
        content: newComment.trim()
      });
      setNewComment('');
      loadComments();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إضافة التعليق');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId, content) => {
    try {
      await axios.post(`${API}/comments/${fileId}`, {
        content,
        parentId
      });
      loadComments();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إضافة الرد');
    }
  };

  const handleEdit = async (commentId, content) => {
    try {
      await axios.patch(`${API}/comments/${commentId}`, { content });
      loadComments();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تعديل التعليق');
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق؟')) return;

    try {
      await axios.delete(`${API}/comments/${commentId}`);
      loadComments();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في حذف التعليق');
    }
  };

  return (
    <div className="comments-panel">
      <div className="comments-header">
        <h4>
          <FiMessageSquare /> التعليقات ({count})
        </h4>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="comment-form">
        <textarea
          ref={inputRef}
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="اكتب تعليقك..."
          rows={2}
          maxLength={2000}
        />
        <button type="submit" disabled={submitting || !newComment.trim()}>
          <FiSend /> {submitting ? 'جاري الإرسال...' : 'إرسال'}
        </button>
      </form>

      <div className="comments-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>جاري تحميل التعليقات...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="empty-state">
            <FiMessageSquare size={32} />
            <p>لا توجد تعليقات بعد</p>
            <small>كن أول من يعلق!</small>
          </div>
        ) : (
          comments.map(comment => (
            <Comment
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <style>{`
        .comments-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
        }

        .comments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .comments-header h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .comment-form {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .comment-form textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          resize: none;
          font-family: inherit;
          margin-bottom: 8px;
        }

        .comment-form button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .comment-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .comment {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
        }

        .comment.reply {
          background: var(--bg-hover);
          border-right: 3px solid var(--primary-color);
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 0.85em;
        }

        .comment-author {
          font-weight: 600;
          color: var(--primary-color);
        }

        .comment-date {
          color: var(--text-secondary);
        }

        .comment-edited {
          color: var(--text-secondary);
          font-style: italic;
        }

        .comment-content {
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .comment-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .comment-actions button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.85em;
          border-radius: 4px;
        }

        .comment-actions button:hover {
          background: var(--bg-hover);
          color: var(--primary-color);
        }

        .comment-actions button.danger:hover {
          color: #dc3545;
        }

        .reply-input, .comment-edit {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
        }

        .reply-input textarea, .comment-edit textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          resize: none;
          font-family: inherit;
        }

        .reply-actions, .edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .reply-actions button, .edit-actions button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85em;
        }

        .reply-actions button:first-child, .edit-actions button:first-child {
          background: var(--primary-color);
          color: white;
        }

        .reply-actions button.cancel, .edit-actions button.cancel {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .comment-replies {
          margin-top: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .empty-state svg {
          opacity: 0.5;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}
