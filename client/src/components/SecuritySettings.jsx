/**
 * Security Settings Component
 * مكون إعدادات الأمان
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  FiShield, FiSmartphone, FiMonitor, FiTablet, FiX, FiCheck, 
  FiAlertTriangle, FiLock, FiUnlock, FiTrash2, FiLogOut,
  FiGlobe, FiKey, FiMail
} from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

export default function SecuritySettings({ onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [devices, setDevices] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load security data
  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, devicesRes] = await Promise.all([
        axios.get(`${API}/security/overview`),
        axios.get(`${API}/security/devices`)
      ]);

      setOverview(overviewRes.data);
      setDevices(devicesRes.data.devices);
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تحميل بيانات الأمان');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  // Remove device
  const handleRemoveDevice = async (deviceId) => {
    if (!confirm('هل أنت متأكد من إزالة هذا الجهاز؟')) return;

    try {
      await axios.delete(`${API}/security/devices/${deviceId}`);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في إزالة الجهاز');
    }
  };

  // Trust/Untrust device
  const handleToggleTrust = async (deviceId, trusted) => {
    try {
      if (trusted) {
        await axios.post(`${API}/security/devices/${deviceId}/untrust`);
      } else {
        await axios.post(`${API}/security/devices/${deviceId}/trust`);
      }
      loadSecurityData();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تحديث حالة الجهاز');
    }
  };

  // Logout all devices
  const handleLogoutAll = async () => {
    if (!confirm('سيتم تسجيل الخروج من جميع الأجهزة. هل أنت متأكد؟')) return;

    try {
      await axios.post(`${API}/security/devices/logout-all`);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'فشل في تسجيل الخروج');
    }
  };

  // Get device icon
  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'Mobile': return <FiSmartphone />;
      case 'Tablet': return <FiTablet />;
      default: return <FiMonitor />;
    }
  };

  // Get security score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="security-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiShield /> إعدادات الأمان</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="security-tabs">
          <button 
            className={activeTab === 'overview' ? 'active' : ''} 
            onClick={() => setActiveTab('overview')}
          >
            نظرة عامة
          </button>
          <button 
            className={activeTab === 'devices' ? 'active' : ''} 
            onClick={() => setActiveTab('devices')}
          >
            الأجهزة ({devices.length})
          </button>
          <button 
            className={activeTab === '2fa' ? 'active' : ''} 
            onClick={() => setActiveTab('2fa')}
          >
            المصادقة الثنائية
          </button>
        </div>

        <div className="security-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري التحميل...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <FiAlertTriangle />
              <p>{error}</p>
              <button onClick={loadSecurityData}>إعادة المحاولة</button>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && overview && (
                <div className="security-overview">
                  <div className="security-score">
                    <div 
                      className="score-circle"
                      style={{ '--score-color': getScoreColor(overview.securityScore) }}
                    >
                      <span className="score-value">{overview.securityScore}</span>
                      <span className="score-label">نقطة الأمان</span>
                    </div>
                  </div>

                  <div className="security-checklist">
                    <div className={`checklist-item ${overview.twoFactorEnabled ? 'enabled' : ''}`}>
                      <div className="item-icon">
                        {overview.twoFactorEnabled ? <FiCheck /> : <FiX />}
                      </div>
                      <div className="item-info">
                        <span className="item-title">المصادقة الثنائية</span>
                        <span className="item-status">
                          {overview.twoFactorEnabled ? 'مفعّلة' : 'غير مفعّلة'}
                        </span>
                      </div>
                      {!overview.twoFactorEnabled && (
                        <button 
                          className="enable-btn"
                          onClick={() => setActiveTab('2fa')}
                        >
                          تفعيل
                        </button>
                      )}
                    </div>

                    <div className={`checklist-item ${overview.emailVerified ? 'enabled' : ''}`}>
                      <div className="item-icon">
                        {overview.emailVerified ? <FiCheck /> : <FiX />}
                      </div>
                      <div className="item-info">
                        <span className="item-title">تأكيد البريد الإلكتروني</span>
                        <span className="item-status">
                          {overview.emailVerified ? 'مؤكد' : 'غير مؤكد'}
                        </span>
                      </div>
                    </div>

                    <div className="checklist-item enabled">
                      <div className="item-icon"><FiSmartphone /></div>
                      <div className="item-info">
                        <span className="item-title">الأجهزة النشطة</span>
                        <span className="item-status">{overview.activeDevices} جهاز</span>
                      </div>
                      <button 
                        className="view-btn"
                        onClick={() => setActiveTab('devices')}
                      >
                        عرض
                      </button>
                    </div>

                    <div className="checklist-item enabled">
                      <div className="item-icon"><FiLock /></div>
                      <div className="item-info">
                        <span className="item-title">الأجهزة الموثوقة</span>
                        <span className="item-status">{overview.trustedDevices} جهاز</span>
                      </div>
                    </div>
                  </div>

                  <div className="security-actions">
                    <button className="danger-btn" onClick={handleLogoutAll}>
                      <FiLogOut /> تسجيل الخروج من جميع الأجهزة
                    </button>
                  </div>
                </div>
              )}

              {/* Devices Tab */}
              {activeTab === 'devices' && (
                <div className="devices-list">
                  {devices.length === 0 ? (
                    <div className="empty-state">
                      <FiSmartphone />
                      <p>لا توجد أجهزة مسجلة</p>
                    </div>
                  ) : (
                    devices.map(device => (
                      <div 
                        key={device.id} 
                        className={`device-item ${device.isCurrent ? 'current' : ''} ${device.status === 'blocked' ? 'blocked' : ''}`}
                      >
                        <div className="device-icon">
                          {getDeviceIcon(device.deviceType)}
                        </div>
                        
                        <div className="device-info">
                          <div className="device-name">
                            {device.name}
                            {device.isCurrent && <span className="current-badge">الجهاز الحالي</span>}
                            {device.trusted && <span className="trusted-badge"><FiLock /> موثوق</span>}
                          </div>
                          <div className="device-meta">
                            <span><FiGlobe /> {device.ip}</span>
                            <span>آخر نشاط: {new Date(device.lastSeenAt).toLocaleDateString('ar')}</span>
                          </div>
                        </div>

                        <div className="device-actions">
                          {!device.isCurrent && (
                            <>
                              <button 
                                className="trust-btn"
                                onClick={() => handleToggleTrust(device.id, device.trusted)}
                                title={device.trusted ? 'إلغاء الثقة' : 'الوثوق بالجهاز'}
                              >
                                {device.trusted ? <FiUnlock /> : <FiLock />}
                              </button>
                              <button 
                                className="remove-btn"
                                onClick={() => handleRemoveDevice(device.id)}
                                title="إزالة الجهاز"
                              >
                                <FiTrash2 />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 2FA Tab */}
              {activeTab === '2fa' && (
                <div className="two-factor-settings">
                  <div className="tfa-status">
                    <div className={`tfa-icon ${overview?.twoFactorEnabled ? 'enabled' : ''}`}>
                      <FiKey />
                    </div>
                    <h3>المصادقة الثنائية (2FA)</h3>
                    <p>
                      {overview?.twoFactorEnabled 
                        ? 'المصادقة الثنائية مفعّلة على حسابك'
                        : 'أضف طبقة حماية إضافية لحسابك'
                      }
                    </p>
                  </div>

                  <div className="tfa-benefits">
                    <h4>فوائد المصادقة الثنائية:</h4>
                    <ul>
                      <li><FiCheck /> حماية إضافية ضد الاختراق</li>
                      <li><FiCheck /> تنبيه فوري عند محاولة الدخول</li>
                      <li><FiCheck /> التحكم في الأجهزة الموثوقة</li>
                    </ul>
                  </div>

                  <div className="tfa-actions">
                    {overview?.twoFactorEnabled ? (
                      <button className="danger-btn">
                        <FiX /> تعطيل المصادقة الثنائية
                      </button>
                    ) : (
                      <button className="primary-btn">
                        <FiKey /> تفعيل المصادقة الثنائية
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
