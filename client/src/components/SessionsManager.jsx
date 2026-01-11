/**
 * Sessions Manager Component
 * إدارة الجلسات والأجهزة المتصلة
 */

import { useState, useEffect, useCallback, memo } from 'react';
import {
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiLogOut,
  FiTrash2,
  FiRefreshCw,
  FiShield,
  FiClock,
  FiMapPin,
  FiAlertTriangle
} from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

const SessionsManager = memo(function SessionsManager({ onClose, showToast, embedded = false }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // تحميل الجلسات
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/security/sessions`);
      setSessions(res.data.sessions || []);
    } catch (error) {
      showToast?.('فشل في تحميل الجلسات', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // إنهاء جلسة
  const terminateSession = async (sessionId) => {
    setActionLoading(sessionId);
    try {
      await axios.delete(`${API}/security/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showToast?.('تم إنهاء الجلسة بنجاح', 'success');
    } catch (error) {
      showToast?.('فشل في إنهاء الجلسة', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // تسجيل الخروج من جميع الأجهزة
  const logoutAllDevices = async (keepCurrent = true) => {
    setActionLoading('all');
    try {
      const res = await axios.post(`${API}/security/sessions/logout-all`, {
        keepCurrent
      });
      showToast?.(res.data.message, 'success');
      loadSessions();
    } catch (error) {
      showToast?.('فشل في تسجيل الخروج', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // أيقونة الجهاز
  const getDeviceIcon = (deviceInfo) => {
    const device = deviceInfo?.device?.toLowerCase() || '';
    if (device.includes('mobile')) return <FiSmartphone />;
    if (device.includes('tablet')) return <FiTablet />;
    return <FiMonitor />;
  };

  // تنسيق التاريخ
  const formatDate = (timestamp) => {
    if (!timestamp) return 'غير معروف';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
    return date.toLocaleDateString('ar-SA');
  };

  // Embedded mode (inside SettingsModal)
  if (embedded) {
    return (
      <div className="sessions-embedded">
        <div className="sessions-header-embedded">
          <h3><FiShield /> الأجهزة المتصلة</h3>
          <button className="refresh-btn" onClick={loadSessions} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} />
          </button>
        </div>
        
        {loading ? (
          <div className="sessions-loading"><FiRefreshCw className="spin" /> جاري التحميل...</div>
        ) : sessions.length === 0 ? (
          <div className="no-sessions"><FiMonitor /><p>لا توجد جلسات نشطة</p></div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div key={session.id} className={`session-item ${session.isCurrent ? 'current' : ''}`}>
                <div className="session-icon">{getDeviceIcon(session.deviceInfo)}</div>
                <div className="session-info">
                  <div className="session-device">
                    {session.deviceInfo?.device || 'جهاز غير معروف'}
                    {session.isCurrent && <span className="current-badge">الحالي</span>}
                  </div>
                  <div className="session-details">
                    <span><FiClock /> {formatDate(session.lastActivity)}</span>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button className="terminate-btn" onClick={() => terminateSession(session.id)} disabled={actionLoading === session.id}>
                    {actionLoading === session.id ? <FiRefreshCw className="spin" /> : <FiTrash2 />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {sessions.length > 1 && (
          <button className="logout-others-btn" onClick={() => logoutAllDevices(true)} disabled={actionLoading === 'all'}>
            <FiLogOut /> تسجيل الخروج من الأجهزة الأخرى
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sessions-manager-overlay" onClick={onClose}>
      <div className="sessions-manager" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sessions-header">
          <div className="header-title">
            <FiShield />
            <h2>الأجهزة المتصلة</h2>
          </div>
          <div className="header-actions">
            <button
              className="refresh-btn"
              onClick={loadSessions}
              disabled={loading}
            >
              <FiRefreshCw className={loading ? 'spin' : ''} />
            </button>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="sessions-content">
          {loading ? (
            <div className="sessions-loading">
              <FiRefreshCw className="spin" />
              <span>جاري التحميل...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="no-sessions">
              <FiMonitor />
              <p>لا توجد جلسات نشطة</p>
            </div>
          ) : (
            <>
              {/* قائمة الجلسات */}
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`session-item ${session.isCurrent ? 'current' : ''}`}
                  >
                    <div className="session-icon">
                      {getDeviceIcon(session.deviceInfo)}
                    </div>

                    <div className="session-info">
                      <div className="session-device">
                        {session.deviceInfo?.device || 'جهاز غير معروف'}
                        {session.isCurrent && (
                          <span className="current-badge">الجهاز الحالي</span>
                        )}
                      </div>

                      <div className="session-details">
                        <span>
                          <FiClock />
                          {formatDate(session.lastActivity)}
                        </span>
                        {session.deviceInfo?.ip && (
                          <span>
                            <FiMapPin />
                            {session.deviceInfo.ip}
                          </span>
                        )}
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        className="terminate-btn"
                        onClick={() => terminateSession(session.id)}
                        disabled={actionLoading === session.id}
                      >
                        {actionLoading === session.id ? (
                          <FiRefreshCw className="spin" />
                        ) : (
                          <FiTrash2 />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* تسجيل الخروج من جميع الأجهزة */}
              {sessions.length > 1 && (
                <div className="logout-all-section">
                  <div className="warning-box">
                    <FiAlertTriangle />
                    <span>
                      تسجيل الخروج من جميع الأجهزة سيؤدي إلى إنهاء جميع الجلسات
                      الأخرى
                    </span>
                  </div>

                  <div className="logout-buttons">
                    <button
                      className="logout-others-btn"
                      onClick={() => logoutAllDevices(true)}
                      disabled={actionLoading === 'all'}
                    >
                      <FiLogOut />
                      تسجيل الخروج من الأجهزة الأخرى
                    </button>

                    <button
                      className="logout-all-btn"
                      onClick={() => logoutAllDevices(false)}
                      disabled={actionLoading === 'all'}
                    >
                      <FiLogOut />
                      تسجيل الخروج من جميع الأجهزة
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default SessionsManager;
