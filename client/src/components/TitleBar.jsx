import { useState, useEffect } from 'react';
import { FiMinus, FiSquare, FiX } from 'react-icons/fi';
import { VscChromeRestore } from 'react-icons/vsc';

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  
  // التحقق إذا كنا في Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  
  useEffect(() => {
    if (!isElectron) return;
    
    const checkMaximized = async () => {
      const maximized = await window.electronAPI.isMaximized();
      setIsMaximized(maximized);
    };
    
    checkMaximized();
    
    // تحديث الحالة عند تغيير حجم النافذة
    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, [isElectron]);
  
  if (!isElectron) return null;
  
  const handleMinimize = () => window.electronAPI.minimizeWindow();
  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.electronAPI.closeWindow();
  
  return (
    <div className="title-bar">
      <div className="title-bar-drag">
        <div className="title-bar-icon">☁️</div>
        <span className="title-bar-text">التخزين السحابي</span>
      </div>
      <div className="title-bar-controls">
        <button className="title-bar-btn minimize" onClick={handleMinimize} title="تصغير">
          <FiMinus />
        </button>
        <button className="title-bar-btn maximize" onClick={handleMaximize} title={isMaximized ? 'استعادة' : 'تكبير'}>
          {isMaximized ? <VscChromeRestore /> : <FiSquare />}
        </button>
        <button className="title-bar-btn close" onClick={handleClose} title="إغلاق">
          <FiX />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
