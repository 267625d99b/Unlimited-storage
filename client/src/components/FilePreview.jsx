import { memo, useEffect, useCallback, useState, useMemo, lazy, Suspense, useRef } from 'react';
import { 
  FiDownload, FiX, FiChevronRight, FiChevronLeft, FiMusic, FiFile,
  FiMaximize, FiMinimize, FiZoomIn, FiZoomOut,
  FiRotateCw, FiGrid, FiRefreshCw, FiInfo
} from 'react-icons/fi';

// Lazy load CodePreview for better performance
const CodePreviewComponent = lazy(() => import('./CodePreview'));

// Syntax highlighting for code files
const CODE_EXTENSIONS = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
  html: 'html', css: 'css', scss: 'scss', json: 'json', xml: 'xml',
  sql: 'sql', sh: 'bash', bash: 'bash', php: 'php', rb: 'ruby',
  go: 'go', rs: 'rust', swift: 'swift', kt: 'kotlin', md: 'markdown',
  yaml: 'yaml', yml: 'yaml', txt: 'text', log: 'text', ini: 'ini',
  env: 'text', gitignore: 'text'
};

// Office file types
const OFFICE_TYPES = {
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint'
};

const FilePreview = memo(function FilePreview({ 
  file, 
  fileUrl, 
  onClose, 
  onDownload, 
  onNext, 
  onPrev, 
  hasNext, 
  hasPrev,
  allFiles = [] // For slideshow
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // File type detection
  const fileExtension = useMemo(() => {
    const parts = file.name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }, [file.name]);

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');
  const isPdf = file.type?.includes('pdf');
  const isOffice = OFFICE_TYPES[file.type];
  const isCode = CODE_EXTENSIONS[fileExtension];
  const isText = file.type?.startsWith('text/') || isCode;
  const is3D = ['stl', 'obj', 'gltf', 'glb'].includes(fileExtension);

  // Get all images for slideshow
  const imageFiles = useMemo(() => 
    allFiles.filter(f => f.type?.startsWith('image/')),
    [allFiles]
  );

  // Load text content for code/text files
  useEffect(() => {
    if (isText && fileUrl) {
      setLoading(true);
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isText, fileUrl]);


  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (slideshowActive) setSlideshowActive(false);
      else onClose();
    }
    if (e.key === 'ArrowRight' && hasPrev) onPrev();
    if (e.key === 'ArrowLeft' && hasNext) onNext();
    if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
    if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    if (e.key === 'r') setRotation(r => r + 90);
    if (e.key === 'f') toggleFullscreen();
    if (e.key === ' ' && isImage && imageFiles.length > 1) {
      e.preventDefault();
      setSlideshowActive(!slideshowActive);
    }
  }, [onClose, onNext, onPrev, hasNext, hasPrev, slideshowActive, isImage, imageFiles.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Slideshow auto-advance
  useEffect(() => {
    if (slideshowActive && imageFiles.length > 1) {
      const timer = setInterval(() => {
        setSlideshowIndex(i => (i + 1) % imageFiles.length);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [slideshowActive, imageFiles.length]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Reset zoom and rotation
  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse drag for panning
  const handleMouseDown = useCallback((e) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  }, [isDragging, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    if (isImage) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(Math.max(z + delta, 0.5), 3));
    }
  }, [isImage]);

  // Reset pan when zoom resets
  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  const handleOverlayClick = useCallback(() => onClose(), [onClose]);
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  // Get Office viewer URL (using Microsoft Office Online)
  const getOfficeViewerUrl = useCallback((url) => {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }, []);

  // Syntax highlighting (simple version)
  const highlightCode = useCallback((code, lang) => {
    // Basic syntax highlighting
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Keywords
    const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 
      'return', 'import', 'export', 'from', 'class', 'extends', 'new', 'this',
      'async', 'await', 'try', 'catch', 'throw', 'true', 'false', 'null', 'undefined'];
    
    keywords.forEach(kw => {
      highlighted = highlighted.replace(
        new RegExp(`\\b(${kw})\\b`, 'g'),
        '<span class="code-keyword">$1</span>'
      );
    });
    
    // Strings
    highlighted = highlighted.replace(
      /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
      '<span class="code-string">$&</span>'
    );
    
    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      '<span class="code-comment">$1</span>'
    );
    
    // Numbers
    highlighted = highlighted.replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="code-number">$1</span>'
    );
    
    return highlighted;
  }, []);

  // Render slideshow
  if (slideshowActive && imageFiles.length > 0) {
    const currentImage = imageFiles[slideshowIndex];
    return (
      <div className="slideshow-overlay" onClick={() => setSlideshowActive(false)}>
        <div className="slideshow-container">
          <img 
            src={currentImage.url || fileUrl} 
            alt={currentImage.name}
            className="slideshow-image"
          />
          <div className="slideshow-controls">
            <span>{slideshowIndex + 1} / {imageFiles.length}</span>
            <button onClick={(e) => { e.stopPropagation(); setSlideshowActive(false); }}>
              <FiX /> إيقاف
            </button>
          </div>
          <div className="slideshow-dots">
            {imageFiles.map((_, i) => (
              <button 
                key={i}
                className={`dot ${i === slideshowIndex ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSlideshowIndex(i); }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-overlay" onClick={handleOverlayClick}>
      <div className="preview-container" onClick={stopPropagation}>
        {/* Header */}
        <div className="preview-header">
          <span className="preview-filename">{file.name}</span>
          <div className="preview-actions">
            {isImage && (
              <>
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} title="تكبير">
                  <FiZoomIn />
                </button>
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="تصغير">
                  <FiZoomOut />
                </button>
                <button onClick={() => setRotation(r => r + 90)} title="تدوير">
                  <FiRotateCw />
                </button>
                {imageFiles.length > 1 && (
                  <button onClick={() => setSlideshowActive(true)} title="عرض شرائح">
                    <FiGrid />
                  </button>
                )}
                <button onClick={resetView} title="إعادة تعيين">
                  <FiRefreshCw />
                </button>
              </>
            )}
            <button onClick={() => setShowInfo(!showInfo)} title="معلومات الملف" className={showInfo ? 'active' : ''}>
              <FiInfo />
            </button>
            <button onClick={toggleFullscreen} title="ملء الشاشة">
              {isFullscreen ? <FiMinimize /> : <FiMaximize />}
            </button>
            <button onClick={onDownload} title="تحميل">
              <FiDownload />
            </button>
            <button onClick={onClose} title="إغلاق">
              <FiX />
            </button>
          </div>
        </div>
        
        {/* File Info Panel */}
        {showInfo && (
          <div className="preview-file-info">
            <div className="file-name">{file.name}</div>
            <div className="file-meta">
              <span>{formatFileSize(file.size)}</span>
              <span>{file.type || fileExtension}</span>
            </div>
            {file.createdAt && (
              <div className="file-date">
                تاريخ الإنشاء: {new Date(file.createdAt).toLocaleDateString('ar-SA')}
              </div>
            )}
          </div>
        )}

        
        {/* Content */}
        <div className="preview-content">
          {hasPrev && (
            <button className="preview-nav prev" onClick={onPrev}>
              <FiChevronRight />
            </button>
          )}
          
          <div className="preview-media">
            {/* Image Preview */}
            {isImage && (
              <div 
                className={`preview-image-container ${zoom > 1 ? 'zoomed' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <img 
                  ref={imageRef}
                  src={fileUrl} 
                  alt={file.name} 
                  loading="lazy"
                  className={zoom > 1 ? 'zoomed' : ''}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s ease',
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                  onDoubleClick={resetView}
                  draggable={false}
                />
              </div>
            )}
            
            {/* Video Preview */}
            {isVideo && (
              <video src={fileUrl} controls autoPlay />
            )}
            
            {/* Audio Preview */}
            {isAudio && (
              <div className="audio-preview">
                <div className="audio-visualizer">
                  <FiMusic size={80} />
                </div>
                <p className="audio-name">{file.name}</p>
                <audio src={fileUrl} controls autoPlay />
              </div>
            )}
            
            {/* PDF Preview */}
            {isPdf && (
              <iframe src={fileUrl} title={file.name} loading="lazy" />
            )}
            
            {/* Office Preview */}
            {isOffice && (
              <div className="office-preview">
                <iframe 
                  src={getOfficeViewerUrl(fileUrl)} 
                  title={file.name}
                  loading="lazy"
                />
                <div className="office-fallback">
                  <p>إذا لم تظهر المعاينة، </p>
                  <button onClick={onDownload}>حمّل الملف</button>
                </div>
              </div>
            )}
            
            {/* Code/Text Preview */}
            {isText && !isOffice && (
              <div className="code-preview-wrapper">
                {loading ? (
                  <div className="code-loading">جاري التحميل...</div>
                ) : (
                  <Suspense fallback={<div className="code-loading">جاري التحميل...</div>}>
                    <CodePreviewComponent 
                      code={textContent} 
                      filename={file.name}
                    />
                  </Suspense>
                )}
              </div>
            )}
            
            {/* 3D Preview */}
            {is3D && (
              <div className="preview-3d">
                <div className="preview-3d-placeholder">
                  <FiFile size={80} />
                  <p>معاينة ملفات 3D</p>
                  <small>{fileExtension.toUpperCase()}</small>
                  <button onClick={onDownload}>تحميل للعرض</button>
                </div>
              </div>
            )}
            
            {/* No Preview Available */}
            {!isImage && !isVideo && !isAudio && !isPdf && !isOffice && !isText && !is3D && (
              <div className="no-preview">
                <FiFile size={80} />
                <p>لا يمكن معاينة هذا الملف</p>
                <small>{file.type || 'نوع غير معروف'}</small>
                <button onClick={onDownload}>تحميل الملف</button>
              </div>
            )}
          </div>
          
          {hasNext && (
            <button className="preview-nav next" onClick={onNext}>
              <FiChevronLeft />
            </button>
          )}
        </div>
        
        {/* Zoom Controls for Images */}
        {isImage && (
          <div className="preview-zoom-controls">
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="تصغير">
              <FiZoomOut />
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} title="تكبير">
              <FiZoomIn />
            </button>
            <button onClick={() => setRotation(r => r + 90)} title="تدوير">
              <FiRotateCw />
            </button>
            <button onClick={resetView} title="إعادة تعيين">
              <FiRefreshCw />
            </button>
          </div>
        )}
        
        {/* Footer with file info */}
        <div className="preview-footer">
          <span className="file-size">{formatFileSize(file.size)}</span>
          <span className="file-type">{file.type || fileExtension}</span>
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="preview-shortcuts">
          <kbd>←</kbd><kbd>→</kbd> تنقل | 
          <kbd>+</kbd><kbd>-</kbd> زوم | 
          <kbd>R</kbd> تدوير | 
          <kbd>F</kbd> ملء الشاشة | 
          <kbd>Esc</kbd> إغلاق
        </div>
      </div>
    </div>
  );
});

// Helper function
function formatFileSize(bytes) {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default FilePreview;
