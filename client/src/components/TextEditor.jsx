/**
 * Text Editor Component
 * محرر النصوص البسيط
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiSave, FiX, FiAlertCircle, FiCheck, FiEye, FiEdit3 } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

export default function TextEditor({ file, url, onClose, onSave }) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');

  useEffect(() => {
    loadContent();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [url]);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  // Auto-save after 30 seconds of inactivity
  useEffect(() => {
    if (hasChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, hasChanges]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(url);
      const text = await response.text();
      setContent(text);
      setOriginalContent(text);
    } catch (err) {
      setError('فشل في تحميل الملف');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (isAutoSave = false) => {
    if (!hasChanges) return;

    try {
      setSaving(true);
      await axios.put(`${API}/files/${file.id}/content`, {
        content
      });
      setOriginalContent(content);
      setHasChanges(false);
      setLastSaved(new Date());
      if (!isAutoSave) {
        onSave?.();
      }
    } catch (err) {
      if (!isAutoSave) {
        alert(err.response?.data?.error || 'فشل في حفظ الملف');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm('لديك تغييرات غير محفوظة. هل تريد الخروج؟')) {
        return;
      }
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Tab to insert spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      // Set cursor position after tab
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Simple Markdown to HTML converter
  const renderMarkdown = (text) => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n/gim, '<br>');
    
    return html;
  };

  if (loading) {
    return (
      <div className="text-editor loading">
        <div className="spinner"></div>
        <p>جاري تحميل الملف...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-editor error">
        <FiAlertCircle size={48} />
        <p>{error}</p>
        <button onClick={onClose}>إغلاق</button>
      </div>
    );
  }

  return (
    <div className="text-editor">
      <div className="editor-header">
        <div className="editor-title">
          <FiEdit3 />
          <span>{file.name}</span>
          {hasChanges && <span className="unsaved-badge">غير محفوظ</span>}
        </div>
        <div className="editor-actions">
          {isMarkdown && (
            <button
              className={`preview-toggle ${showPreview ? 'active' : ''}`}
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? 'تحرير' : 'معاينة'}
            >
              {showPreview ? <FiEdit3 /> : <FiEye />}
              {showPreview ? 'تحرير' : 'معاينة'}
            </button>
          )}
          <button
            className="save-btn"
            onClick={() => handleSave()}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>جاري الحفظ...</>
            ) : (
              <>
                <FiSave /> حفظ
              </>
            )}
          </button>
          <button className="close-btn" onClick={handleClose}>
            <FiX />
          </button>
        </div>
      </div>

      <div className="editor-body">
        {showPreview && isMarkdown ? (
          <div 
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="ابدأ الكتابة..."
          />
        )}
      </div>

      <div className="editor-footer">
        <div className="editor-stats">
          <span>{content.length} حرف</span>
          <span>{content.split(/\s+/).filter(w => w).length} كلمة</span>
          <span>{content.split('\n').length} سطر</span>
        </div>
        {lastSaved && (
          <div className="last-saved">
            <FiCheck /> آخر حفظ: {lastSaved.toLocaleTimeString('ar-SA')}
          </div>
        )}
        <div className="editor-hint">
          Ctrl+S للحفظ • Tab للمسافة البادئة
        </div>
      </div>

      <style>{`
        .text-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
        }

        .text-editor.loading,
        .text-editor.error {
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 40px;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .editor-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .unsaved-badge {
          font-size: 0.75em;
          padding: 2px 8px;
          background: #ffc107;
          color: #000;
          border-radius: 12px;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .editor-actions button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .preview-toggle {
          background: var(--bg-hover);
        }

        .preview-toggle.active {
          background: var(--primary-color);
          color: white;
        }

        .save-btn {
          background: var(--primary-color);
          color: white;
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .close-btn {
          background: transparent;
          color: var(--text-primary);
        }

        .close-btn:hover {
          background: var(--bg-hover);
        }

        .editor-body {
          flex: 1;
          overflow: hidden;
        }

        .editor-body textarea {
          width: 100%;
          height: 100%;
          padding: 16px;
          border: none;
          resize: none;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 14px;
          line-height: 1.6;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .editor-body textarea:focus {
          outline: none;
        }

        .markdown-preview {
          height: 100%;
          overflow: auto;
          padding: 24px;
          line-height: 1.8;
        }

        .markdown-preview h1 {
          font-size: 2em;
          margin: 16px 0;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }

        .markdown-preview h2 {
          font-size: 1.5em;
          margin: 14px 0;
        }

        .markdown-preview h3 {
          font-size: 1.2em;
          margin: 12px 0;
        }

        .markdown-preview code {
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }

        .markdown-preview pre {
          background: var(--bg-secondary);
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
        }

        .markdown-preview pre code {
          background: none;
          padding: 0;
        }

        .markdown-preview a {
          color: var(--primary-color);
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          font-size: 0.85em;
          color: var(--text-secondary);
        }

        .editor-stats {
          display: flex;
          gap: 16px;
        }

        .last-saved {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #28a745;
        }

        .editor-hint {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
