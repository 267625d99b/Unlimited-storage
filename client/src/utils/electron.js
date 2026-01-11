/**
 * Electron integration utilities
 * يوفر واجهة موحدة للتعامل مع Electron APIs
 */

// التحقق إذا كان التطبيق يعمل داخل Electron
export const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI !== undefined && 
         window.electronAPI.isElectron === true;
};

// الحصول على إصدار التطبيق
export const getAppVersion = async () => {
  if (isElectron()) {
    return await window.electronAPI.getAppVersion();
  }
  return null;
};

// الحصول على مسار بيانات التطبيق
export const getAppPath = async () => {
  if (isElectron()) {
    return await window.electronAPI.getAppPath();
  }
  return null;
};

// فتح نافذة اختيار الملفات (native)
export const selectFiles = async () => {
  if (isElectron()) {
    return await window.electronAPI.selectFiles();
  }
  return null;
};

// فتح نافذة اختيار مجلد (native)
export const selectFolder = async () => {
  if (isElectron()) {
    return await window.electronAPI.selectFolder();
  }
  return null;
};

// الاستماع لأحداث من main process
export const onUploadFile = (callback) => {
  if (isElectron()) {
    window.electronAPI.onUploadFile(callback);
  }
};

export const onNewFolder = (callback) => {
  if (isElectron()) {
    window.electronAPI.onNewFolder(callback);
  }
};

export const onOpenSettings = (callback) => {
  if (isElectron()) {
    window.electronAPI.onOpenSettings(callback);
  }
};

// إزالة المستمعين
export const removeListeners = () => {
  if (isElectron()) {
    window.electronAPI.removeAllListeners('upload-file');
    window.electronAPI.removeAllListeners('new-folder');
    window.electronAPI.removeAllListeners('open-settings');
  }
};

// الحصول على نظام التشغيل
export const getPlatform = () => {
  if (isElectron()) {
    return window.electronAPI.platform;
  }
  return 'web';
};

export default {
  isElectron,
  getAppVersion,
  getAppPath,
  selectFiles,
  selectFolder,
  onUploadFile,
  onNewFolder,
  onOpenSettings,
  removeListeners,
  getPlatform
};
