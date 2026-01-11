import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { FiX, FiMoon, FiSun, FiCheck, FiShield, FiHardDrive, FiMonitor } from 'react-icons/fi';

// Lazy load heavy components
const SessionsManager = lazy(() => import('./SessionsManager'));
const NetworkDriveGuide = lazy(() => import('./NetworkDriveGuide'));

const COLORS = [
  { id: 'blue', name: 'أزرق', color: '#1a73e8' },
  { id: 'green', name: 'أخضر', color: '#1e8e3e' },
  { id: 'purple', name: 'بنفسجي', color: '#9334e6' },
  { id: 'orange', name: 'برتقالي', color: '#ea8600' },
  { id: 'red', name: 'أحمر', color: '#d93025' },
  { id: 'teal', name: 'فيروزي', color: '#009688' }
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'U'], action: 'رفع ملفات' },
  { keys: ['Ctrl', 'N'], action: 'مجلد جديد' },
  { keys: ['Ctrl', 'F'], action: 'بحث' },
  { keys: ['Delete'], action: 'حذف المحدد' },
  { keys: ['Ctrl', 'A'], action: 'تحديد الكل' },
  { keys: ['Escape'], action: 'إلغاء التحديد' },
  { keys: ['Enter'], action: 'فتح الملف/المجلد' },
  { keys: ['Ctrl', 'D'], action: 'تحميل المحدد' },
  { keys: ['F2'], action: 'إعادة تسمية' }
];

const SettingsModal = memo(function SettingsModal({ onClose, showToast }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem('colorScheme') || 'blue');
  const [activeTab, setActiveTab] = useState('appearance');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-color', colorScheme);
    localStorage.setItem('colorScheme', colorScheme);
  }, [colorScheme]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal settings-modal-large">
        <div className="settings-header">
          <h2>الإعدادات</h2>
          <button className="close-btn" onClick={onClose} aria-label="إغلاق"><FiX /></button>
        </div>

        <div className="settings-tabs">
          <button 
            className={activeTab === 'appearance' ? 'active' : ''}
            onClick={() => setActiveTab('appearance')}
          >
            <FiSun /> المظهر
          </button>
          <button 
            className={activeTab === 'shortcuts' ? 'active' : ''}
            onClick={() => setActiveTab('shortcuts')}
          >
            ⌨️ الاختصارات
          </button>
          <button 
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            <FiShield /> الأمان
          </button>
          <button 
            className={activeTab === 'webdav' ? 'active' : ''}
            onClick={() => setActiveTab('webdav')}
          >
            <FiHardDrive /> WebDAV
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'appearance' && (
            <>
              <div className="settings-section">
                <h3>الوضع</h3>
                <div className="theme-options">
                  <button 
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <FiSun />
                    <span>فاتح</span>
                    {theme === 'light' && <FiCheck className="check" />}
                  </button>
                  <button 
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <FiMoon />
                    <span>داكن</span>
                    {theme === 'dark' && <FiCheck className="check" />}
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>اللون الرئيسي</h3>
                <div className="color-options">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      className={`color-btn ${colorScheme === c.id ? 'active' : ''}`}
                      style={{ '--btn-color': c.color }}
                      onClick={() => setColorScheme(c.id)}
                      title={c.name}
                      aria-label={c.name}
                    >
                      {colorScheme === c.id && <FiCheck />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <h3>معاينة</h3>
                <div className="theme-preview">
                  <div className="preview-card">
                    <div className="preview-header-bar"></div>
                    <div className="preview-sidebar"></div>
                    <div className="preview-content">
                      <div className="preview-item"></div>
                      <div className="preview-item"></div>
                      <div className="preview-item active"></div>
                      <div className="preview-item"></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'shortcuts' && (
            <div className="settings-section">
              <h3>اختصارات لوحة المفاتيح</h3>
              <div className="shortcuts-list">
                {SHORTCUTS.map((shortcut, i) => (
                  <div key={i} className="shortcut-item">
                    <span className="shortcut-action">{shortcut.action}</span>
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd>{key}</kbd>
                          {j < shortcut.keys.length - 1 && ' + '}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <Suspense fallback={<div className="loading-spinner"><FiMonitor /> جاري التحميل...</div>}>
              <SessionsManager showToast={showToast} embedded />
            </Suspense>
          )}

          {activeTab === 'webdav' && (
            <Suspense fallback={<div className="loading-spinner"><FiHardDrive /> جاري التحميل...</div>}>
              <NetworkDriveGuide embedded />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
});

export default SettingsModal;
