/**
 * Excel Preview Component
 * مكون معاينة ملفات Excel
 */

import { useState, useEffect } from 'react';
import { FiFileText, FiDownload, FiAlertCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function ExcelPreview({ url, fileName }) {
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSpreadsheet();
  }, [url]);

  const loadSpreadsheet = async () => {
    try {
      setLoading(true);
      setError(null);

      // Dynamically import xlsx
      const XLSX = await import('xlsx');
      
      // Fetch the file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Parse workbook
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Convert each sheet to JSON
      const sheetsData = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        return { name, data };
      });
      
      setSheets(sheetsData);
    } catch (err) {
      setError('فشل في تحميل الملف. قد لا يكون بتنسيق صحيح.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="excel-preview loading">
        <div className="spinner"></div>
        <p>جاري تحميل الجدول...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="excel-preview error">
        <FiAlertCircle size={48} />
        <p>{error}</p>
        <a href={url} download={fileName} className="download-btn">
          <FiDownload /> تحميل الملف
        </a>
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];

  return (
    <div className="excel-preview">
      <div className="excel-header">
        <FiFileText />
        <span>{fileName}</span>
        <a href={url} download={fileName} className="download-btn">
          <FiDownload /> تحميل
        </a>
      </div>

      {/* Sheet Tabs */}
      {sheets.length > 1 && (
        <div className="sheet-tabs">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              className={`sheet-tab ${activeSheet === index ? 'active' : ''}`}
              onClick={() => setActiveSheet(index)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table Content */}
      <div className="excel-content">
        {currentSheet && currentSheet.data.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th className="row-number">#</th>
                {currentSheet.data[0]?.map((_, colIndex) => (
                  <th key={colIndex}>{getColumnLetter(colIndex)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="row-number">{rowIndex + 1}</td>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-sheet">
            <p>الورقة فارغة</p>
          </div>
        )}
      </div>

      <div className="excel-footer">
        <span>
          {currentSheet?.data.length || 0} صف × {currentSheet?.data[0]?.length || 0} عمود
        </span>
        {sheets.length > 1 && (
          <div className="sheet-nav">
            <button
              disabled={activeSheet === 0}
              onClick={() => setActiveSheet(activeSheet - 1)}
            >
              <FiChevronRight />
            </button>
            <span>{activeSheet + 1} / {sheets.length}</span>
            <button
              disabled={activeSheet === sheets.length - 1}
              onClick={() => setActiveSheet(activeSheet + 1)}
            >
              <FiChevronLeft />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .excel-preview {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .excel-preview.loading,
        .excel-preview.error {
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
        }

        .excel-preview.error svg {
          color: #dc3545;
          margin-bottom: 16px;
        }

        .excel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #217346;
          color: white;
        }

        .excel-header .download-btn {
          margin-right: auto;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.2);
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .excel-header .download-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .sheet-tabs {
          display: flex;
          gap: 2px;
          padding: 0 8px;
          background: #f0f0f0;
          border-bottom: 1px solid #ddd;
          overflow-x: auto;
        }

        .sheet-tab {
          padding: 8px 16px;
          background: #e0e0e0;
          border: none;
          border-radius: 4px 4px 0 0;
          cursor: pointer;
          font-size: 0.9em;
          white-space: nowrap;
        }

        .sheet-tab.active {
          background: white;
          border-bottom: 2px solid #217346;
        }

        .excel-content {
          flex: 1;
          overflow: auto;
        }

        .excel-content table {
          border-collapse: collapse;
          width: max-content;
          min-width: 100%;
        }

        .excel-content th,
        .excel-content td {
          border: 1px solid #ddd;
          padding: 6px 12px;
          text-align: right;
          min-width: 80px;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .excel-content th {
          background: #f5f5f5;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .excel-content .row-number {
          background: #f5f5f5;
          color: #666;
          text-align: center;
          min-width: 50px;
          position: sticky;
          right: 0;
        }

        .excel-content tbody tr:hover {
          background: #f9f9f9;
        }

        .empty-sheet {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
        }

        .excel-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #f5f5f5;
          border-top: 1px solid #ddd;
          font-size: 0.85em;
          color: #666;
        }

        .sheet-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sheet-nav button {
          padding: 4px 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }

        .sheet-nav button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// Helper: Get column letter (A, B, C, ... AA, AB, etc.)
function getColumnLetter(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

// Helper: Format cell value
function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    // Format numbers with commas
    return value.toLocaleString('ar-SA');
  }
  return String(value);
}
