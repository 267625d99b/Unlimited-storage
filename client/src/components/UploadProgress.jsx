/**
 * Enhanced Upload Progress Component
 * مكون عرض تقدم رفع الملفات المحسن
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiPlay, FiFile, FiFolder, FiChevronDown, FiChevronUp, FiClock, FiZap } from 'react-icons/fi';
import { formatSize } from '../utils/helpers';

// حساب السرعة والوقت المتبقي
const useUploadStats = (upload) => {
  const [stats, setStats] = useState({ speed: 0, eta: 0, avgSpeed: 0 });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (upload.status !== 'uploading') return;

    const now = Date.now();
    const uploaded = (upload.progress / 100) * upload.fileSize;

    setHistory(prev => {
      const newHistory = [...prev, { time: now, bytes: uploaded }].slice(-10);
      
      if (newHistory.length >= 2) {
        const oldest = newHistory[0];
        const newest = newHistory[newHistory.length - 1];
        const timeDiff = (newest.time - oldest.time) / 1000;
        const bytesDiff = newest.bytes - oldest.bytes;
        
        if (timeDiff > 0) {
          const speed = bytesDiff / timeDiff;
          const remaining = upload.fileSize - uploaded;
          const eta = speed > 0 ? remaining / speed : 0;
          
          setStats({ speed, eta, avgSpeed: speed });
        }
      }
      
      return newHistory;
    });
  }, [upload.progress, upload.fileSize, upload.status]);

  return stats;
};

// تنسيق الوقت المتبقي
const formatETA = (seconds) => {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)} ثانية`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} دقيقة`;
  return `${Math.round(seconds / 3600)} ساعة`;
};

// تنسيق السرعة
const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '--';
  return `${formatSize(bytesPerSecond)}/ث`;
};

const UploadProgress = memo(function UploadProgress({ 
  uploads, 
  onCancel, 
  onRetry,
  onPause,
  onResume,
  onClear,
  minimized = false,
  onToggleMinimize
}) {
  const uploadList = Object.entries(uploads);
  const [expanded, setExpanded] = useState(true);
  
  if (uploadList.length === 0) return null;

  const activeUploads = uploadList.filter(([, u]) => 
    u.status === 'uploading' || u.status === 'initializing' || u.status === 'resuming' || u.status === 'completing' || u.status === 'paused'
  );
  const completedUploads = uploadList.filter(([, u]) => u.status === 'completed');
  const failedUploads = uploadList.filter(([, u]) => u.status === 'error');

  const totalProgress = activeUploads.length > 0
    ? Math.round(activeUploads.reduce((sum, [, u]) => sum + (u.progress || 0), 0) / activeUploads.length)
    : 100;

  const totalSize = uploadList.reduce((sum, [, u]) => sum + (u.fileSize || 0), 0);
  const uploadedSize = uploadList.reduce((sum, [, u]) => sum + ((u.progress / 100) * u.fileSize || 0), 0);

  if (minimized) {
    return (
      <div className="upload-progress-minimized" onClick={onToggleMinimize}>
        <div className="upload-mini-icon">
          {activeUploads.length > 0 ? (
            <div className="spinner small" />
          ) : failedUploads.length > 0 ? (
            <FiAlertCircle className="error" />
          ) : (
            <FiCheck className="success" />
          )}
        </div>
        <div className="upload-mini-info">
          {activeUploads.length > 0 ? (
            <>
              <span className="mini-progress">{totalProgress}%</span>
              <span className="mini-count">{activeUploads.length} ملف</span>
            </>
          ) : (
            <span>{completedUploads.length} ✓ {failedUploads.length > 0 && `${failedUploads.length} ✗`}</span>
          )}
        </div>
        <div className="upload-mini-bar">
          <div className="progress-fill" style={{ width: `${totalProgress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="upload-progress-panel">
      <div className="upload-progress-header" onClick={() => setExpanded(!expanded)}>
        <div className="header-title">
          <h3>
            {activeUploads.length > 0 ? (
              <>
                <div className="spinner small" />
                جاري الرفع ({activeUploads.length})
              </>
            ) : failedUploads.length > 0 ? (
              <>
                <FiAlertCircle className="error" />
                فشل بعض الملفات
              </>
            ) : (
              <>
                <FiCheck className="success" />
                اكتمل الرفع
              </>
            )}
          </h3>
          <span className="header-size">
            {formatSize(uploadedSize)} / {formatSize(totalSize)}
          </span>
        </div>
        <div className="header-actions">
          {completedUploads.length > 0 && (
            <button className="clear-btn" onClick={(e) => { e.stopPropagation(); onClear?.(); }}>
              مسح
            </button>
          )}
          <button className="toggle-btn">
            {expanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="upload-progress-list">
            {uploadList.map(([key, upload]) => (
              <UploadItem 
                key={key}
                upload={upload}
                onCancel={() => onCancel?.(upload.uploadId)}
                onRetry={() => onRetry?.(upload)}
                onPause={() => onPause?.(upload.uploadId)}
                onResume={() => onResume?.(upload.uploadId)}
              />
            ))}
          </div>

          {activeUploads.length > 0 && (
            <div className="upload-progress-total">
              <div className="progress-bar">
                <div 
                  className="progress-fill animated" 
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <div className="progress-stats">
                <span className="progress-percent">{totalProgress}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

const UploadItem = memo(function UploadItem({ upload, onCancel, onRetry, onPause, onResume }) {
  const { fileName, fileSize, progress, status, error, uploadedChunks, totalChunks, isFolder } = upload;
  const stats = useUploadStats(upload);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <FiCheck className="status-icon success" />;
      case 'error':
        return <FiAlertCircle className="status-icon error" />;
      case 'cancelled':
        return <FiX className="status-icon cancelled" />;
      case 'paused':
        return <FiClock className="status-icon paused" />;
      case 'uploading':
      case 'resuming':
      case 'completing':
        return <div className="spinner small" />;
      default:
        return isFolder ? <FiFolder className="status-icon folder" /> : <FiFile className="status-icon" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'initializing':
        return 'جاري التهيئة...';
      case 'uploading':
        if (stats.speed > 0) {
          return (
            <span className="status-with-stats">
              <FiZap className="speed-icon" />
              {formatSpeed(stats.speed)}
              <FiClock className="eta-icon" />
              {formatETA(stats.eta)}
            </span>
          );
        }
        return totalChunks > 1 
          ? `${uploadedChunks || 0}/${totalChunks} أجزاء`
          : 'جاري الرفع...';
      case 'resuming':
        return 'جاري الاستئناف...';
      case 'completing':
        return 'جاري الإكمال...';
      case 'completed':
        return 'اكتمل ✓';
      case 'paused':
        return 'متوقف مؤقتاً';
      case 'error':
        return error || 'فشل الرفع';
      case 'cancelled':
        return 'تم الإلغاء';
      default:
        return status;
    }
  };

  return (
    <div className={`upload-item ${status}`}>
      <div className="upload-item-icon">
        {getStatusIcon()}
      </div>
      
      <div className="upload-item-info">
        <div className="upload-item-name" title={fileName}>
          {fileName}
        </div>
        <div className="upload-item-meta">
          <span className="upload-item-size">{formatSize(fileSize)}</span>
          <span className="upload-item-status">{getStatusText()}</span>
        </div>
        
        {(status === 'uploading' || status === 'resuming' || status === 'paused') && (
          <div className="upload-item-progress">
            <div className={`progress-bar small ${status === 'paused' ? 'paused' : ''}`}>
              <div 
                className="progress-fill" 
                style={{ width: `${progress || 0}%` }}
              />
            </div>
            <span className="progress-text">{progress || 0}%</span>
          </div>
        )}
      </div>

      <div className="upload-item-actions">
        {status === 'uploading' && onPause && (
          <button className="pause-btn" onClick={onPause} title="إيقاف مؤقت">
            <FiClock />
          </button>
        )}
        {status === 'paused' && onResume && (
          <button className="resume-btn" onClick={onResume} title="استئناف">
            <FiPlay />
          </button>
        )}
        {(status === 'uploading' || status === 'resuming' || status === 'initializing' || status === 'paused') && (
          <button className="cancel-btn" onClick={onCancel} title="إلغاء">
            <FiX />
          </button>
        )}
        {status === 'error' && onRetry && (
          <button className="retry-btn" onClick={onRetry} title="إعادة المحاولة">
            <FiPlay />
          </button>
        )}
      </div>
    </div>
  );
});

export default UploadProgress;
