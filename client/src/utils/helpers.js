// Format file size
export const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date
export const formatDate = (dateStr) => {
  if (!dateStr) return 'غير معروف';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get file type info (icon, color, label)
export const getFileTypeInfo = (type, name) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  
  if (type?.startsWith('image/')) {
    return { color: '#ea4335', label: ext?.toUpperCase() || 'IMG', bg: '#fce8e6', iconType: 'image' };
  }
  if (type?.startsWith('video/')) {
    return { color: '#4285f4', label: ext?.toUpperCase() || 'VID', bg: '#e8f0fe', iconType: 'video' };
  }
  if (type?.startsWith('audio/')) {
    return { color: '#fbbc04', label: ext?.toUpperCase() || 'AUD', bg: '#fef7e0', iconType: 'audio' };
  }
  if (type?.includes('pdf') || ext === 'pdf') {
    return { color: '#ea4335', label: 'PDF', bg: '#fce8e6', iconType: 'doc' };
  }
  if (type?.includes('word') || ['doc', 'docx'].includes(ext)) {
    return { color: '#4285f4', label: ext?.toUpperCase(), bg: '#e8f0fe', iconType: 'doc' };
  }
  if (type?.includes('excel') || type?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return { color: '#34a853', label: ext?.toUpperCase(), bg: '#e6f4ea', iconType: 'doc' };
  }
  if (type?.includes('powerpoint') || type?.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
    return { color: '#ff6d01', label: ext?.toUpperCase(), bg: '#fee8d6', iconType: 'doc' };
  }
  if (type?.includes('text') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) {
    return { color: '#5f6368', label: ext?.toUpperCase() || 'TXT', bg: '#f1f3f4', iconType: 'doc' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { color: '#9334e6', label: ext?.toUpperCase(), bg: '#f3e8fd', iconType: 'file' };
  }
  return { color: '#5f6368', label: ext?.toUpperCase() || 'FILE', bg: '#f1f3f4', iconType: 'file' };
};

// Check if file can be previewed
export const canPreview = (type) => {
  return type?.startsWith('image/') || 
         type?.startsWith('video/') || 
         type?.startsWith('audio/') || 
         type?.includes('pdf');
};

// Validate file/folder name
export const isValidName = (name) => {
  if (!name || typeof name !== 'string') return false;
  if (name.trim().length === 0 || name.length > 255) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return true;
};

// Error message mapping for better UX
const errorMessages = {
  // Network errors
  'Network Error': 'فشل الاتصال بالخادم. تحقق من اتصالك بالإنترنت',
  'timeout': 'انتهت مهلة الاتصال. حاول مرة أخرى',
  
  // Auth errors
  'Invalid credentials': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'Token expired': 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى',
  'Unauthorized': 'غير مصرح لك بهذا الإجراء',
  'Access denied': 'تم رفض الوصول',
  
  // File errors
  'File not found': 'الملف غير موجود',
  'File too large': 'حجم الملف كبير جداً',
  'Invalid file type': 'نوع الملف غير مدعوم',
  'Storage limit exceeded': 'تم تجاوز حد التخزين المسموح',
  'File already exists': 'يوجد ملف بنفس الاسم',
  
  // Folder errors
  'Folder not found': 'المجلد غير موجود',
  'Folder not empty': 'المجلد غير فارغ',
  'Cannot move folder into itself': 'لا يمكن نقل المجلد إلى نفسه',
  
  // General errors
  'Server error': 'حدث خطأ في الخادم. حاول لاحقاً',
  'Bad request': 'طلب غير صالح',
  'Not found': 'العنصر غير موجود',
  'Conflict': 'يوجد تعارض في البيانات',
  'Rate limit exceeded': 'تم تجاوز الحد المسموح. انتظر قليلاً',
};

// Get user-friendly error message
export const getErrorMessage = (error, fallback = 'حدث خطأ غير متوقع') => {
  // Handle axios error
  if (error?.response?.data?.error) {
    const serverError = error.response.data.error;
    return errorMessages[serverError] || serverError;
  }
  
  // Handle axios error message
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Handle network error
  if (error?.message === 'Network Error') {
    return errorMessages['Network Error'];
  }
  
  // Handle timeout
  if (error?.code === 'ECONNABORTED') {
    return errorMessages['timeout'];
  }
  
  // Handle status codes
  if (error?.response?.status) {
    const status = error.response.status;
    if (status === 401) return errorMessages['Unauthorized'];
    if (status === 403) return errorMessages['Access denied'];
    if (status === 404) return errorMessages['Not found'];
    if (status === 409) return errorMessages['Conflict'];
    if (status === 413) return errorMessages['File too large'];
    if (status === 429) return errorMessages['Rate limit exceeded'];
    if (status >= 500) return errorMessages['Server error'];
  }
  
  // Handle string error
  if (typeof error === 'string') {
    return errorMessages[error] || error;
  }
  
  // Handle error message
  if (error?.message) {
    return errorMessages[error.message] || error.message;
  }
  
  return fallback;
};
