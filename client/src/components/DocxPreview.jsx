/**
 * DOCX Preview Component
 * مكون معاينة ملفات Word
 */

import { useState, useEffect } from 'react';
import { FiFileText, FiDownload, FiAlertCircle } from 'react-icons/fi';

export default function DocxPreview({ url, fileName }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocument();
  }, [url]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      // Dynamically import mammoth
      const mammoth = await import('mammoth');
      
      // Fetch the file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert to HTML
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setContent(result.value);
      
      if (result.messages.length > 0) {
        console.warn('Mammoth warnings:', result.messages);
      }
    } catch (err) {
      setError('فشل في تحميل المستند. قد لا يكون الملف بتنسيق صحيح.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="docx-preview loading">
        <div className="spinner"></div>
        <p>جاري تحميل المستند...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="docx-preview error">
        <FiAlertCircle size={48} />
        <p>{error}</p>
        <a href={url} download={fileName} className="download-btn">
          <FiDownload /> تحميل الملف
        </a>
      </div>
    );
  }

  return (
    <div className="docx-preview">
      <div className="docx-header">
        <FiFileText />
        <span>{fileName}</span>
        <a href={url} download={fileName} className="download-btn">
          <FiDownload /> تحميل
        </a>
      </div>
      <div 
        className="docx-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <style>{`
        .docx-preview {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .docx-preview.loading,
        .docx-preview.error {
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
        }

        .docx-preview.error svg {
          color: #dc3545;
          margin-bottom: 16px;
        }

        .docx-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .docx-header .download-btn {
          margin-right: auto;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: var(--primary-color);
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .docx-content {
          flex: 1;
          overflow: auto;
          padding: 24px 32px;
          font-family: 'Times New Roman', serif;
          font-size: 14px;
          line-height: 1.8;
          color: #333;
        }

        .docx-content h1 {
          font-size: 24px;
          margin: 24px 0 16px;
        }

        .docx-content h2 {
          font-size: 20px;
          margin: 20px 0 12px;
        }

        .docx-content h3 {
          font-size: 16px;
          margin: 16px 0 8px;
        }

        .docx-content p {
          margin: 12px 0;
        }

        .docx-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }

        .docx-content table td,
        .docx-content table th {
          border: 1px solid #ddd;
          padding: 8px 12px;
        }

        .docx-content table th {
          background: #f5f5f5;
          font-weight: bold;
        }

        .docx-content ul,
        .docx-content ol {
          margin: 12px 0;
          padding-right: 24px;
        }

        .docx-content img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
