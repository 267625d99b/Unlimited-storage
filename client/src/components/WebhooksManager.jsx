import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, RefreshCw, Check, X, Play, Eye, EyeOff, Copy, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function WebhooksManager({ token }) {
  const [webhooks, setWebhooks] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [expandedDelivery, setExpandedDelivery] = useState(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState([]);

  useEffect(() => {
    fetchWebhooks();
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedWebhook) {
      fetchDeliveries(selectedWebhook.id);
    }
  }, [selectedWebhook]);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (e) {
      // Error handled by UI
    }
    setLoading(false);
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAvailableEvents(data.events || []);
    } catch (e) {
      // Error handled by UI
    }
  };

  const fetchDeliveries = async (webhookId) => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks/${webhookId}/deliveries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          url: newUrl,
          events: newEvents
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewName('');
        setNewUrl('');
        setNewEvents([]);
        fetchWebhooks();
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleDelete = async (webhookId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الـ Webhook؟')) return;

    try {
      await fetch(`${API_URL}/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedWebhook(null);
      fetchWebhooks();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleToggle = async (webhook) => {
    try {
      await fetch(`${API_URL}/api/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: !webhook.active })
      });
      fetchWebhooks();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleTest = async (webhookId) => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchDeliveries(webhookId);
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleRetry = async (deliveryId) => {
    try {
      await fetch(`${API_URL}/api/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (selectedWebhook) {
        fetchDeliveries(selectedWebhook.id);
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleRegenerateSecret = async (webhookId) => {
    if (!confirm('هل أنت متأكد؟ سيتم إنشاء مفتاح سري جديد.')) return;

    try {
      const res = await fetch(`${API_URL}/api/webhooks/${webhookId}/regenerate-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`المفتاح السري الجديد:\n${data.secret}\n\nاحفظه الآن، لن يظهر مرة أخرى!`);
        fetchWebhooks();
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const toggleEvent = (event) => {
    setNewEvents(prev => 
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getEventLabel = (event) => {
    const labels = {
      'file.uploaded': 'رفع ملف',
      'file.deleted': 'حذف ملف',
      'file.shared': 'مشاركة ملف',
      'file.downloaded': 'تحميل ملف',
      'folder.created': 'إنشاء مجلد',
      'folder.deleted': 'حذف مجلد',
      'user.registered': 'تسجيل مستخدم',
      'user.login': 'تسجيل دخول',
      'share.created': 'إنشاء مشاركة',
      'share.accessed': 'الوصول لمشاركة',
      'comment.added': 'إضافة تعليق',
      'team.created': 'إنشاء فريق',
      'team.member_added': 'إضافة عضو للفريق'
    };
    return labels[event] || event;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="w-6 h-6" />
            Webhooks
          </h1>
          <p className="text-gray-500">إدارة التكاملات الخارجية</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          إضافة Webhook
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webhooks List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Webhook className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>لا توجد Webhooks</p>
            </div>
          ) : (
            webhooks.map((webhook) => (
              <div
                key={webhook.id}
                onClick={() => setSelectedWebhook(webhook)}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  selectedWebhook?.id === webhook.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{webhook.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    webhook.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {webhook.active ? 'نشط' : 'معطل'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{webhook.url}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {webhook.events.slice(0, 3).map((event) => (
                    <span key={event} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      {getEventLabel(event)}
                    </span>
                  ))}
                  {webhook.events.length > 3 && (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      +{webhook.events.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Webhook Details */}
        <div className="lg:col-span-2">
          {selectedWebhook ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
              {/* Details Header */}
              <div className="p-4 border-b dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{selectedWebhook.name}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTest(selectedWebhook.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Play className="w-4 h-4" />
                      اختبار
                    </button>
                    <button
                      onClick={() => handleToggle(selectedWebhook)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                        selectedWebhook.active
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {selectedWebhook.active ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button
                      onClick={() => handleDelete(selectedWebhook.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Details Content */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-500">URL</label>
                  <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">{selectedWebhook.url}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">المفتاح السري</label>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded flex-1">
                      {selectedWebhook.secret}
                    </p>
                    <button
                      onClick={() => handleRegenerateSecret(selectedWebhook.id)}
                      className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="إعادة إنشاء"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-500">الأحداث</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedWebhook.events.map((event) => (
                      <span key={event} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                        {getEventLabel(event)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Deliveries */}
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">سجل التسليم</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deliveries.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">لا توجد عمليات تسليم</p>
                    ) : (
                      deliveries.map((delivery) => (
                        <div key={delivery.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                          <div
                            onClick={() => setExpandedDelivery(
                              expandedDelivery === delivery.id ? null : delivery.id
                            )}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(delivery.status)}`}>
                                {delivery.status}
                              </span>
                              <span className="text-sm">{delivery.event}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{new Date(delivery.createdAt).toLocaleString('ar')}</span>
                              {expandedDelivery === delivery.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                          
                          {expandedDelivery === delivery.id && (
                            <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 space-y-2">
                              {delivery.responseStatus && (
                                <p className="text-sm">
                                  <span className="text-gray-500">الحالة:</span> {delivery.responseStatus}
                                </p>
                              )}
                              {delivery.error && (
                                <p className="text-sm text-red-500">{delivery.error}</p>
                              )}
                              {delivery.status !== 'success' && (
                                <button
                                  onClick={() => handleRetry(delivery.id)}
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  إعادة المحاولة
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Webhook className="w-12 h-12 mb-2 opacity-50" />
              <p>اختر Webhook لعرض التفاصيل</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">إضافة Webhook جديد</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: Slack Integration"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">الأحداث</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {availableEvents.map((event) => (
                    <label
                      key={event}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                        newEvents.includes(event)
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                          : 'bg-gray-50 dark:bg-gray-700'
                      } border`}
                    >
                      <input
                        type="checkbox"
                        checked={newEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded"
                      />
                      <span className="text-sm">{getEventLabel(event)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={newEvents.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  إنشاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
