import { useState } from 'react';
import { FiX, FiCpu, FiFileText, FiImage, FiZap, FiTag, FiCheck } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

const AIPanel = ({ onClose, selectedFile, onTagsAdded, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analyze');

  const analyzeFile = async () => {
    if (!selectedFile) {
      setError('يرجى تحديد ملف أولاً');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post(`${API}/ai/analyze`, {
        fileId: selectedFile.id
      });
      setResult({ type: 'analysis', data: res.data });
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تحليل الملف');
    } finally {
      setLoading(false);
    }
  };

  const extractText = async () => {
    if (!selectedFile) {
      setError('يرجى تحديد ملف أولاً');
      return;
    }

    if (!selectedFile.type?.startsWith('image/')) {
      setError('استخراج النص متاح للصور فقط');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post(`${API}/ai/ocr/file/${selectedFile.id}`);
      setResult({ type: 'ocr', data: res.data });
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في استخراج النص');
    } finally {
      setLoading(false);
    }
  };

  const summarize = async () => {
    if (!selectedFile) {
      setError('يرجى تحديد ملف أولاً');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post(`${API}/ai/summarize/file/${selectedFile.id}`);
      setResult({ type: 'summary', data: res.data });
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تلخيص الملف');
    } finally {
      setLoading(false);
    }
  };

  const applyTags = async (tags) => {
    if (!selectedFile || !tags?.length) return;
    
    try {
      const res = await axios.post(`${API}/ai/classify/file/${selectedFile.id}`, {
        autoApply: true
      });
      showToast?.('تم إضافة الوسوم بنجاح', 'success');
      onTagsAdded?.();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في إضافة الوسوم', 'error');
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.type === 'analysis') {
      const data = result.data;
      return (
        <div className="ai-result">
          <h4>تحليل الملف</h4>
          <div className="analysis-grid">
            <div className="analysis-item">
              <span className="label">التصنيف:</span>
              <span className="value">{data.category}</span>
            </div>
            <div className="analysis-item">
              <span className="label">النوع:</span>
              <span className="value">{data.type}</span>
            </div>
            <div className="analysis-item">
              <span className="label">يدعم OCR:</span>
              <span className="value">{data.canOCR ? '✅ نعم' : '❌ لا'}</span>
            </div>
            <div className="analysis-item">
              <span className="label">يدعم التلخيص:</span>
              <span className="value">{data.canSummarize ? '✅ نعم' : '❌ لا'}</span>
            </div>
          </div>
          
          {data.suggestedTags?.length > 0 && (
            <div className="suggested-tags">
              <h5><FiTag /> الوسوم المقترحة:</h5>
              <div className="tags-list">
                {data.suggestedTags.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
              <button className="apply-tags-btn" onClick={() => applyTags(data.suggestedTags)}>
                <FiCheck /> تطبيق الوسوم
              </button>
            </div>
          )}
        </div>
      );
    }

    if (result.type === 'ocr') {
      return (
        <div className="ai-result">
          <h4>النص المستخرج</h4>
          <div className="ocr-info">
            <span>الدقة: {result.data.confidence?.toFixed(1)}%</span>
            <span>الكلمات: {result.data.words}</span>
          </div>
          <pre className="extracted-text">{result.data.text || 'لم يتم العثور على نص'}</pre>
        </div>
      );
    }

    if (result.type === 'summary') {
      return (
        <div className="ai-result">
          <h4>ملخص المحتوى</h4>
          <pre className="summary-text">{result.data.summary}</pre>
          <small className="method">الطريقة: {result.data.method === 'ai' ? 'ذكاء اصطناعي' : 'محلي'}</small>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={e => e.stopPropagation()}>
        <div className="ai-panel-header">
          <h2><FiCpu /> الذكاء الاصطناعي</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="ai-panel-tabs">
          <button 
            className={`ai-tab ${activeTab === 'analyze' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analyze'); setResult(null); setError(null); }}
          >
            <FiZap /> تحليل
          </button>
          <button 
            className={`ai-tab ${activeTab === 'ocr' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ocr'); setResult(null); setError(null); }}
          >
            <FiImage /> استخراج نص
          </button>
          <button 
            className={`ai-tab ${activeTab === 'summarize' ? 'active' : ''}`}
            onClick={() => { setActiveTab('summarize'); setResult(null); setError(null); }}
          >
            <FiFileText /> تلخيص
          </button>
        </div>

        <div className="ai-panel-content">
          {selectedFile ? (
            <div className="selected-file-info">
              <FiFileText />
              <div>
                <span className="filename">{selectedFile.name}</span>
                <span className="filetype">{selectedFile.type || 'غير معروف'}</span>
              </div>
            </div>
          ) : (
            <div className="no-file-selected">
              <FiCpu size={48} />
              <p>حدد ملفاً من القائمة لتحليله</p>
              <small>اضغط على ملف ثم افتح لوحة الذكاء الاصطناعي</small>
            </div>
          )}

          {error && <div className="ai-error">{error}</div>}

          {selectedFile && (
            <div className="ai-actions">
              {activeTab === 'analyze' && (
                <button 
                  className="ai-action-btn" 
                  onClick={analyzeFile}
                  disabled={loading}
                >
                  <FiZap />
                  {loading ? 'جاري التحليل...' : 'تحليل الملف'}
                </button>
              )}

              {activeTab === 'ocr' && (
                <button 
                  className="ai-action-btn" 
                  onClick={extractText}
                  disabled={loading || !selectedFile.type?.startsWith('image/')}
                >
                  <FiImage />
                  {loading ? 'جاري الاستخراج...' : 'استخراج النص (OCR)'}
                </button>
              )}

              {activeTab === 'summarize' && (
                <button 
                  className="ai-action-btn" 
                  onClick={summarize}
                  disabled={loading}
                >
                  <FiFileText />
                  {loading ? 'جاري التلخيص...' : 'تلخيص المحتوى'}
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="ai-loading">
              <div className="spinner"></div>
              <span>جاري المعالجة...</span>
            </div>
          )}

          {renderResult()}
        </div>
      </div>

      <style>{`
        .ai-panel {
          background: var(--bg-primary, white);
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ai-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .ai-panel-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 18px;
        }
        .ai-panel-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .ai-tab {
          flex: 1;
          padding: 12px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-secondary, #666);
          transition: all 0.2s;
        }
        .ai-tab:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
        .ai-tab.active {
          color: var(--primary-color, #1a73e8);
          border-bottom: 2px solid var(--primary-color, #1a73e8);
        }
        .ai-panel-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        .selected-file-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .selected-file-info > div {
          display: flex;
          flex-direction: column;
        }
        .selected-file-info .filename {
          font-weight: 500;
        }
        .selected-file-info .filetype {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }
        .no-file-selected {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary, #666);
        }
        .no-file-selected p {
          margin: 16px 0 8px;
        }
        .ai-error {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .ai-actions {
          margin-bottom: 16px;
        }
        .ai-action-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: var(--primary-color, #1a73e8);
          color: white;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .ai-action-btn:hover:not(:disabled) {
          background: var(--primary-hover, #1557b0);
        }
        .ai-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .ai-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px;
          color: var(--text-secondary, #666);
        }
        .ai-result {
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 12px;
          padding: 16px;
        }
        .ai-result h4 {
          margin: 0 0 12px;
          font-size: 15px;
        }
        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .analysis-item {
          display: flex;
          flex-direction: column;
          padding: 8px;
          background: var(--bg-primary, white);
          border-radius: 6px;
        }
        .analysis-item .label {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }
        .analysis-item .value {
          font-weight: 500;
        }
        .suggested-tags {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #e0e0e0);
        }
        .suggested-tags h5 {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0 0 8px;
          font-size: 14px;
        }
        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .tags-list .tag {
          padding: 4px 10px;
          background: var(--primary-color, #1a73e8);
          color: white;
          border-radius: 12px;
          font-size: 13px;
        }
        .apply-tags-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #4caf50;
          color: white;
          cursor: pointer;
        }
        .apply-tags-btn:hover {
          background: #43a047;
        }
        .ocr-info {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
          font-size: 13px;
          color: var(--text-secondary, #666);
        }
        .extracted-text, .summary-text {
          background: var(--bg-primary, white);
          padding: 12px;
          border-radius: 8px;
          white-space: pre-wrap;
          font-family: inherit;
          font-size: 14px;
          max-height: 200px;
          overflow-y: auto;
          margin: 0;
        }
        .method {
          display: block;
          margin-top: 8px;
          color: var(--text-secondary, #666);
        }
      `}</style>
    </div>
  );
};

export default AIPanel;
