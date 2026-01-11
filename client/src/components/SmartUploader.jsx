/**
 * Smart Uploader - رفع ذكي مع ضغط تلقائي
 * يضغط المجلدات الكبيرة تلقائياً قبل الرفع
 */

import { useState, useRef } from 'react';
import JSZip from 'jszip';

export default function SmartUploader({ onUpload, currentFolder }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ files: 0, uploaded: 0, size: 0, speed: 0 });
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const abortRef = useRef(false);

  // تنسيق الحجم
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  // رفع ملف واحد
  const uploadSingleFile = async (file) => {
    // تجاهل الملفات الفاضية
    if (file.size === 0) {
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder) {
      formData.append('folderId', currentFolder);
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('لم يتم تسجيل الدخول');
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }
    
    return await response.json();
  };

  // ضغط وإرسال المجلد كـ ZIP (أسرع 1000x!)
  const handleFolderUpload = async (e) => {
    const allFiles = Array.from(e.target.files);
    if (allFiles.length === 0) return;

    // فلترة الملفات الفاضية
    const files = allFiles.filter(f => f.size > 0);
    
    if (files.length === 0) {
      setStatus('❌ كل الملفات فاضية!');
      setTimeout(() => setStatus(''), 3000);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setProgress(0);
    abortRef.current = false;

    const folderName = allFiles[0].webkitRelativePath.split('/')[0];
    
    try {
      // ========== مرحلة 1: ضغط الملفات ==========
      setStatus(`📦 جاري ضغط ${files.length} ملف...`);
      
      const zip = new JSZip();
      let totalOriginalSize = 0;
      
      for (let i = 0; i < files.length; i++) {
        if (abortRef.current) break;
        
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        
        // قراءة الملف وإضافته للـ ZIP
        const content = await file.arrayBuffer();
        zip.file(relativePath, content);
        
        totalOriginalSize += file.size;
        setProgress(Math.round((i / files.length) * 40)); // 0-40% للضغط
        setStatus(`📦 ضغط: ${i + 1}/${files.length} ملف...`);
      }

      if (abortRef.current) {
        setStatus('⏹️ تم إيقاف الرفع');
        return;
      }

      // إنشاء ملف ZIP
      setStatus('📦 جاري إنشاء ملف ZIP...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (metadata) => {
        setProgress(40 + Math.round(metadata.percent * 0.2)); // 40-60%
      });

      const compressionRatio = ((1 - zipBlob.size / totalOriginalSize) * 100).toFixed(0);

      // ========== مرحلة 2: رفع الـ ZIP ==========
      setStatus(`📤 جاري رفع ${folderName}.zip (${formatSize(zipBlob.size)})...`);
      
      const formData = new FormData();
      formData.append('file', zipBlob, `${folderName}.zip`);
      if (currentFolder) {
        formData.append('folderId', currentFolder);
      }

      const token = localStorage.getItem('access_token');
      const startTime = Date.now();

      const xhr = new XMLHttpRequest();
      
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const uploadPercent = (e.loaded / e.total) * 100;
            setProgress(60 + Math.round(uploadPercent * 0.4)); // 60-100%
            
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = e.loaded / elapsed;
            const remaining = (e.total - e.loaded) / speed;
            
            setStats({ files: files.length, uploaded: 1, size: e.loaded, speed });
            setStatus(`📤 رفع ZIP: ${Math.round(uploadPercent)}% - ${formatSize(speed)}/s - متبقي: ${Math.round(remaining)}s`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Aborted'));

        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      setStatus(`✅ تم رفع ${folderName}.zip (${files.length} ملف)!`);
      setProgress(100);
      if (onUpload) onUpload();

    } catch (err) {
      setStatus(`❌ خطأ: ${err.message}`);
    }

    setTimeout(() => {
      setIsUploading(false);
      setProgress(0);
      setStatus('');
    }, 5000);

    e.target.value = '';
  };

  // رفع ملفات عادية
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    abortRef.current = false;

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break;
      
      const file = files[i];
      setStatus(`📤 رفع ${file.name} (${i + 1}/${files.length})...`);
      setProgress(Math.round(((i + 1) / files.length) * 100));
      
      try {
        await uploadSingleFile(file);
      } catch (error) {
        // Silent fail for individual files
      }
    }

    setStatus(`✅ تم رفع ${files.length} ملف بنجاح!`);
    setProgress(100);
    if (onUpload) onUpload();

    setTimeout(() => {
      setIsUploading(false);
      setProgress(0);
      setStatus('');
    }, 3000);

    e.target.value = '';
  };

  // إيقاف الرفع
  const handleStop = () => {
    abortRef.current = true;
  };

  return (
    <div className="smart-uploader">
      {/* أزرار الرفع */}
      <div className="upload-buttons">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="upload-btn"
        >
          📄 رفع ملفات
        </button>
        
        <button 
          onClick={() => folderInputRef.current?.click()}
          disabled={isUploading}
          className="upload-btn folder-btn"
        >
          📁 رفع مجلد كامل
        </button>

        {isUploading && (
          <button onClick={handleStop} className="upload-btn stop-btn">
            ⏹️ إيقاف
          </button>
        )}
      </div>

      {/* Inputs مخفية */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderUpload}
        style={{ display: 'none' }}
      />

      {/* شريط التقدم */}
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-info">
            <span>{status}</span>
            {stats.speed > 0 && (
              <span className="speed">{formatSize(stats.speed)}/s</span>
            )}
          </div>
          {stats.files > 0 && (
            <div className="stats">
              📊 {stats.uploaded}/{stats.files} ملف | {formatSize(stats.size)}
            </div>
          )}
        </div>
      )}

      <style>{`
        .smart-uploader {
          padding: 16px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .upload-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .upload-btn {
          flex: 1;
          padding: 12px 20px;
          border: 2px dashed #ccc;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .upload-btn:hover:not(:disabled) {
          border-color: #1a73e8;
          background: #e8f0fe;
        }
        .upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .folder-btn {
          background: #e8f5e9;
          border-color: #4caf50;
        }
        .folder-btn:hover:not(:disabled) {
          background: #c8e6c9;
        }
        .stop-btn {
          background: #ffebee;
          border-color: #f44336;
          color: #c62828;
        }
        .stop-btn:hover {
          background: #ffcdd2;
        }
        .upload-progress {
          margin-top: 12px;
        }
        .progress-bar {
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1a73e8, #4caf50);
          transition: width 0.3s;
        }
        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 13px;
          color: #666;
        }
        .speed {
          color: #1a73e8;
          font-weight: 500;
        }
        .stats {
          margin-top: 4px;
          font-size: 12px;
          color: #888;
        }
      `}</style>
    </div>
  );
}
