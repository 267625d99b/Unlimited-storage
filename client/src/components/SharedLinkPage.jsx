import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { File, Folder, Download, Lock, Mail, LogIn, Eye, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function SharedLinkPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkData, setLinkData] = useState(null);
  
  // Auth requirements
  const [requirePassword, setRequirePassword] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);
  
  // Form inputs
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    accessLink();
  }, [code]);

  const accessLink = async (pwd = null, mail = null) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (pwd) params.set('password', pwd);
      if (mail) params.set('email', mail);

      const res = await fetch(`${API_URL}/api/s/${code}?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLinkData(data.link);
        setRequirePassword(false);
        setRequireEmail(false);
        setRequireLogin(false);
      } else {
        if (data.requirePassword) {
          setRequirePassword(true);
        } else if (data.requireEmail) {
          setRequireEmail(true);
        } else if (data.requireLogin) {
          setRequireLogin(true);
        } else {
          setError(data.error || 'الرابط غير صالح');
        }
      }
    } catch (e) {
      setError('فشل في الوصول للرابط');
    }

    setLoading(false);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    accessLink(password, email);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    accessLink(password, email);
  };

  const handleDownload = async () => {
    try {
      // Record download
      await fetch(`${API_URL}/api/s/${code}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email })
      });

      // Get file and download
      const res = await fetch(`${API_URL}/api/download/${linkData.itemId}`);
      const data = await res.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) {
      // Download error handled
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  const getFileIcon = (type) => {
    if (type === 'folder') return <Folder className="w-16 h-16 text-yellow-500" />;
    return <File className="w-16 h-16 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">الرابط غير متاح</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (requirePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <Lock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold">محمي بكلمة مرور</h1>
            <p className="text-gray-500 text-sm mt-2">هذا الرابط محمي بكلمة مرور</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="أدخل كلمة المرور"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              متابعة
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (requireEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold">التحقق من البريد</h1>
            <p className="text-gray-500 text-sm mt-2">هذا الرابط متاح لعناوين بريد محددة فقط</p>
          </div>
          
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="أدخل بريدك الإلكتروني"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              متابعة
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (requireLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <LogIn className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">تسجيل الدخول مطلوب</h1>
          <p className="text-gray-500 text-sm mb-6">يجب تسجيل الدخول للوصول لهذا الرابط</p>
          <a
            href={`/login?redirect=/s/${code}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            {getFileIcon(linkData.itemType)}
            <h1 className="text-xl font-bold mt-4">{linkData.itemName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              تمت مشاركته بواسطة {linkData.ownerName}
            </p>
          </div>

          <div className="space-y-3">
            {linkData.permission === 'download' || linkData.permission === 'edit' ? (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Download className="w-5 h-5" />
                تحميل
              </button>
            ) : (
              <button
                onClick={() => window.open(`${API_URL}/api/download/${linkData.itemId}`, '_blank')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
              >
                <Eye className="w-5 h-5" />
                معاينة
              </button>
            )}
          </div>

          <div className="mt-6 pt-6 border-t dark:border-gray-700">
            <p className="text-xs text-gray-400 text-center">
              الصلاحية: {linkData.permission === 'view' ? 'عرض فقط' : linkData.permission === 'download' ? 'تحميل' : 'تعديل'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
