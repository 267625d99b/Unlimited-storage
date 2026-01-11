import { useState, useEffect } from 'react';
import { X, Link, Copy, Check, Users, Lock, Calendar, Download, Mail, Eye, Edit, Shield, Trash2, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ShareModal({ isOpen, onClose, item, token }) {
  const [activeTab, setActiveTab] = useState('users');
  const [shares, setShares] = useState([]);
  const [publicLinks, setPublicLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  
  // New share form
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [shareMessage, setShareMessage] = useState('');
  
  // Public link form
  const [linkPermission, setLinkPermission] = useState('view');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkExpiry, setLinkExpiry] = useState('');
  const [linkMaxDownloads, setLinkMaxDownloads] = useState('');
  const [linkRequireLogin, setLinkRequireLogin] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      fetchShares();
    }
  }, [isOpen, item]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sharing/item/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setShares(data.shares || []);
      setPublicLinks(data.publicLinks || []);
    } catch (e) {
      // Error handled by UI
    }
    setLoading(false);
  };

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/sharing/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type || 'file',
          itemName: item.name,
          targetEmail: shareEmail,
          permission: sharePermission,
          message: shareMessage
        })
      });
      
      if (res.ok) {
        setShareEmail('');
        setShareMessage('');
        fetchShares();
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleCreateLink = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sharing/public-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type || 'file',
          itemName: item.name,
          permission: linkPermission,
          password: linkPassword || null,
          expiresAt: linkExpiry || null,
          maxDownloads: linkMaxDownloads ? parseInt(linkMaxDownloads) : null,
          requireLogin: linkRequireLogin
        })
      });
      
      if (res.ok) {
        setLinkPassword('');
        setLinkExpiry('');
        setLinkMaxDownloads('');
        fetchShares();
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      await fetch(`${API_URL}/api/sharing/share/${shareId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchShares();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleDisableLink = async (linkId) => {
    try {
      await fetch(`${API_URL}/api/sharing/public-link/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchShares();
    } catch (e) {
      // Error handled by UI
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getPermissionIcon = (permission) => {
    switch (permission) {
      case 'view': return <Eye className="w-4 h-4" />;
      case 'download': return <Download className="w-4 h-4" />;
      case 'edit': return <Edit className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getPermissionLabel = (permission) => {
    const labels = {
      view: 'عرض فقط',
      download: 'عرض وتحميل',
      edit: 'تعديل',
      admin: 'إدارة كاملة'
    };
    return labels[permission] || permission;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">مشاركة "{item?.name}"</h2>
            <p className="text-sm text-gray-500">إدارة صلاحيات الوصول والروابط</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline ml-2" />
            مشاركة مع مستخدمين
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'links'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Link className="w-4 h-4 inline ml-2" />
            روابط عامة
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'users' ? (
            <div className="space-y-4">
              {/* Share Form */}
              <form onSubmit={handleShare} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="البريد الإلكتروني"
                    className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    required
                  />
                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="view">عرض</option>
                    <option value="download">تحميل</option>
                    <option value="edit">تعديل</option>
                    <option value="admin">إدارة</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    مشاركة
                  </button>
                </div>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="رسالة اختيارية..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                  rows={2}
                />
              </form>

              {/* Shared Users List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500">المستخدمون المشاركون</h3>
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : shares.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لم تتم مشاركة هذا العنصر مع أي مستخدم</p>
                ) : (
                  shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {share.targetUserName?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{share.targetUserName || share.targetEmail}</p>
                          <p className="text-xs text-gray-500">{share.targetEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                          {getPermissionIcon(share.permission)}
                          {getPermissionLabel(share.permission)}
                        </span>
                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Create Link Form */}
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-sm font-medium">إنشاء رابط جديد</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">الصلاحية</label>
                    <select
                      value={linkPermission}
                      onChange={(e) => setLinkPermission(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    >
                      <option value="view">عرض فقط</option>
                      <option value="download">تحميل</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">كلمة مرور (اختياري)</label>
                    <input
                      type="password"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">تاريخ الانتهاء</label>
                    <input
                      type="datetime-local"
                      value={linkExpiry}
                      onChange={(e) => setLinkExpiry(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">حد التحميلات</label>
                    <input
                      type="number"
                      value={linkMaxDownloads}
                      onChange={(e) => setLinkMaxDownloads(e.target.value)}
                      placeholder="غير محدود"
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linkRequireLogin}
                    onChange={(e) => setLinkRequireLogin(e.target.checked)}
                    className="rounded"
                  />
                  يتطلب تسجيل الدخول
                </label>

                <button
                  onClick={handleCreateLink}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Link className="w-4 h-4 inline ml-2" />
                  إنشاء رابط
                </button>
              </div>

              {/* Links List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500">الروابط النشطة</h3>
                {publicLinks.filter(l => l.status === 'active').length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لا توجد روابط نشطة</p>
                ) : (
                  publicLinks.filter(l => l.status === 'active').map((link) => (
                    <div key={link.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-blue-500" />
                          <code className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                            {link.shortCode}
                          </code>
                          {link.password && <Lock className="w-3 h-3 text-yellow-500" />}
                          {link.expiresAt && <Calendar className="w-3 h-3 text-orange-500" />}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(link.url || `${window.location.origin}/s/${link.shortCode}`, link.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            {copied === link.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDisableLink(link.id)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{link.views} مشاهدة</span>
                        <span>{link.downloadCount} تحميل</span>
                        {link.maxDownloads && (
                          <span>متبقي: {link.maxDownloads - link.downloadCount}</span>
                        )}
                        {link.expiresAt && (
                          <span>ينتهي: {new Date(link.expiresAt).toLocaleDateString('ar')}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
