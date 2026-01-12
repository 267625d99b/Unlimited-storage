/**
 * Admin Panel Component
 * لوحة تحكم المدير
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FiX, FiUsers, FiHardDrive, FiActivity, FiSettings, FiDatabase,
  FiUserPlus, FiEdit2, FiTrash2, FiLock, FiUnlock, FiRefreshCw,
  FiDownload, FiSearch, FiChevronLeft, FiChevronRight, FiShield,
  FiAlertCircle, FiCheckCircle, FiClock, FiFile, FiFolder
} from 'react-icons/fi';
import './AdminPanel.css';

const API = '/api';

// Format bytes to human readable
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AdminPanel({ isOpen, onClose, currentUser, showToast }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Dashboard stats
  const [stats, setStats] = useState(null);
  
  // Users
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [usersSearch, setUsersSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', displayName: '', role: 'user' });
  
  // Activity logs
  const [activities, setActivities] = useState([]);
  const [activitiesPagination, setActivitiesPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  
  // Backups
  const [backups, setBackups] = useState([]);

  // Load dashboard stats
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/stats`);
      setStats(res.data);
    } catch (err) {
      showToast?.('فشل في تحميل الإحصائيات', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load users
  const loadUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/users`, {
        params: { page, limit: 20, search: usersSearch }
      });
      setUsers(res.data.users || []);
      setUsersPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      showToast?.('فشل في تحميل المستخدمين', 'error');
    } finally {
      setLoading(false);
    }
  }, [usersSearch, showToast]);

  // Load activity logs
  const loadActivities = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/activity`, {
        params: { page, limit: 50 }
      });
      setActivities(res.data.logs || []);
      setActivitiesPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      showToast?.('فشل في تحميل السجلات', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load backups
  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/backups`);
      setBackups(res.data.backups || []);
    } catch (err) {
      // Silent fail - might not have permission
    } finally {
      setLoading(false);
    }
  }, []);

  // Create backup
  const createBackup = async () => {
    try {
      await axios.post(`${API}/admin/backups`);
      showToast?.('تم إنشاء نسخة احتياطية', 'success');
      loadBackups();
    } catch (err) {
      showToast?.('فشل في إنشاء النسخة الاحتياطية', 'error');
    }
  };

  // Create user
  const createUser = async () => {
    try {
      await axios.post(`${API}/admin/users`, userForm);
      showToast?.('تم إنشاء المستخدم بنجاح', 'success');
      setShowUserModal(false);
      setUserForm({ username: '', email: '', password: '', displayName: '', role: 'user' });
      loadUsers();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في إنشاء المستخدم', 'error');
    }
  };

  // Update user
  const updateUser = async (userId, updates) => {
    try {
      await axios.patch(`${API}/admin/users/${userId}`, updates);
      showToast?.('تم تحديث المستخدم', 'success');
      loadUsers();
      setSelectedUser(null);
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في تحديث المستخدم', 'error');
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      showToast?.('تم حذف المستخدم', 'success');
      loadUsers();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في حذف المستخدم', 'error');
    }
  };

  // Suspend/Activate user
  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      if (currentStatus === 'active') {
        await axios.post(`${API}/admin/users/${userId}/suspend`);
        showToast?.('تم إيقاف الحساب', 'success');
      } else {
        await axios.post(`${API}/admin/users/${userId}/activate`);
        showToast?.('تم تفعيل الحساب', 'success');
      }
      loadUsers();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في تغيير حالة المستخدم', 'error');
    }
  };

  // Reset password
  const resetPassword = async (userId) => {
    const newPassword = prompt('أدخل كلمة المرور الجديدة:');
    if (!newPassword) return;
    try {
      await axios.post(`${API}/admin/users/${userId}/reset-password`, { newPassword });
      showToast?.('تم إعادة تعيين كلمة المرور', 'success');
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في إعادة تعيين كلمة المرور', 'error');
    }
  };

  // Assign orphan files
  const assignOrphanFiles = async () => {
    try {
      const res = await axios.post(`${API}/admin/assign-orphan-files`);
      showToast?.(res.data.message, 'success');
      loadStats();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'فشل في ربط الملفات', 'error');
    }
  };

  // Load data on tab change
  useEffect(() => {
    if (!isOpen) return;
    
    if (activeTab === 'dashboard') loadStats();
    else if (activeTab === 'users') loadUsers();
    else if (activeTab === 'activity') loadActivities();
    else if (activeTab === 'system') loadBackups();
  }, [isOpen, activeTab, loadStats, loadUsers, loadActivities, loadBackups]);

  // Search users with debounce
  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => loadUsers(), 300);
      return () => clearTimeout(timer);
    }
  }, [usersSearch, activeTab, loadUsers]);

  if (!isOpen) return null;

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'مدير أعلى';
      case 'admin': return 'مدير';
      case 'user': return 'مستخدم';
      case 'guest': return 'زائر';
      default: return role;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'suspended': return 'موقوف';
      default: return status;
    }
  };

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <h2><FiShield /> لوحة التحكم</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="admin-content">
          {/* Sidebar */}
          <div className="admin-sidebar">
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('dashboard')}
            >
              <FiActivity /> الرئيسية
            </button>
            <button 
              className={activeTab === 'users' ? 'active' : ''} 
              onClick={() => setActiveTab('users')}
            >
              <FiUsers /> المستخدمين
            </button>
            <button 
              className={activeTab === 'activity' ? 'active' : ''} 
              onClick={() => setActiveTab('activity')}
            >
              <FiClock /> سجل النشاط
            </button>
            {currentUser?.role === 'super_admin' && (
              <button 
                className={activeTab === 'system' ? 'active' : ''} 
                onClick={() => setActiveTab('system')}
              >
                <FiDatabase /> النظام
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="admin-main">
            {loading && <div className="admin-loading"><div className="spinner"></div></div>}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && stats && (
              <div className="dashboard-tab">
                <h3>نظرة عامة</h3>
                
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon users"><FiUsers /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.users?.total || 0}</span>
                      <span className="stat-label">إجمالي المستخدمين</span>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon files"><FiFile /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.storage?.totalFiles || 0}</span>
                      <span className="stat-label">إجمالي الملفات</span>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon folders"><FiFolder /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.storage?.totalFolders || 0}</span>
                      <span className="stat-label">إجمالي المجلدات</span>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon storage"><FiHardDrive /></div>
                    <div className="stat-info">
                      <span className="stat-value">{formatSize(stats.storage?.totalSize || 0)}</span>
                      <span className="stat-label">حجم التخزين</span>
                    </div>
                  </div>
                </div>

                <div className="stats-details">
                  <div className="detail-card">
                    <h4>المستخدمين حسب الدور</h4>
                    <ul>
                      <li><span>مدير أعلى</span><span>{stats.users?.byRole?.superAdmin || 0}</span></li>
                      <li><span>مدير</span><span>{stats.users?.byRole?.admin || 0}</span></li>
                      <li><span>مستخدم</span><span>{stats.users?.byRole?.user || 0}</span></li>
                      <li><span>زائر</span><span>{stats.users?.byRole?.guest || 0}</span></li>
                    </ul>
                  </div>
                  
                  <div className="detail-card">
                    <h4>حالة المستخدمين</h4>
                    <ul>
                      <li><span className="status-active">نشط</span><span>{stats.users?.byStatus?.active || 0}</span></li>
                      <li><span className="status-suspended">موقوف</span><span>{stats.users?.byStatus?.suspended || 0}</span></li>
                    </ul>
                  </div>
                  
                  <div className="detail-card">
                    <h4>المحذوفات</h4>
                    <ul>
                      <li><span>عناصر في سلة المحذوفات</span><span>{stats.storage?.trashItems || 0}</span></li>
                    </ul>
                  </div>
                </div>

                {currentUser?.role === 'super_admin' && (
                  <div className="quick-actions">
                    <h4>إجراءات سريعة</h4>
                    <button onClick={assignOrphanFiles}>
                      <FiRefreshCw /> ربط الملفات بدون مالك
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="users-tab">
                <div className="tab-header">
                  <h3>إدارة المستخدمين</h3>
                  <button className="add-btn" onClick={() => setShowUserModal(true)}>
                    <FiUserPlus /> إضافة مستخدم
                  </button>
                </div>

                <div className="search-bar">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="البحث عن مستخدم..."
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                  />
                </div>

                <div className="users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>المستخدم</th>
                        <th>البريد</th>
                        <th>الدور</th>
                        <th>الحالة</th>
                        <th>تاريخ الإنشاء</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-cell">
                              <span className="username">{user.username}</span>
                              {user.displayName && <small>{user.displayName}</small>}
                            </div>
                          </td>
                          <td>{user.email || '-'}</td>
                          <td><span className={`role-badge ${user.role}`}>{getRoleLabel(user.role)}</span></td>
                          <td><span className={`status-badge ${user.status}`}>{getStatusLabel(user.status)}</span></td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <div className="action-btns">
                              <button title="تعديل" onClick={() => setSelectedUser(user)}><FiEdit2 /></button>
                              <button title="إعادة تعيين كلمة المرور" onClick={() => resetPassword(user.id)}><FiLock /></button>
                              <button 
                                title={user.status === 'active' ? 'إيقاف' : 'تفعيل'} 
                                onClick={() => toggleUserStatus(user.id, user.status)}
                              >
                                {user.status === 'active' ? <FiLock /> : <FiUnlock />}
                              </button>
                              {user.id !== currentUser?.id && (
                                <button title="حذف" className="delete" onClick={() => deleteUser(user.id)}><FiTrash2 /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {usersPagination.totalPages > 1 && (
                  <div className="pagination">
                    <button 
                      disabled={usersPagination.page <= 1}
                      onClick={() => loadUsers(usersPagination.page - 1)}
                    >
                      <FiChevronRight />
                    </button>
                    <span>{usersPagination.page} / {usersPagination.totalPages}</span>
                    <button 
                      disabled={usersPagination.page >= usersPagination.totalPages}
                      onClick={() => loadUsers(usersPagination.page + 1)}
                    >
                      <FiChevronLeft />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="activity-tab">
                <h3>سجل النشاط</h3>
                
                <div className="activity-list">
                  {activities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-icon">
                        <FiActivity />
                      </div>
                      <div className="activity-info">
                        <span className="activity-action">{activity.action}</span>
                        <span className="activity-target">{activity.target_name || activity.target_id}</span>
                        <span className="activity-user">{activity.user_id}</span>
                      </div>
                      <div className="activity-time">
                        {formatDate(activity.created_at)}
                      </div>
                    </div>
                  ))}
                  
                  {activities.length === 0 && (
                    <div className="empty-state">
                      <FiActivity size={48} />
                      <p>لا توجد سجلات</p>
                    </div>
                  )}
                </div>

                {activitiesPagination.totalPages > 1 && (
                  <div className="pagination">
                    <button 
                      disabled={activitiesPagination.page <= 1}
                      onClick={() => loadActivities(activitiesPagination.page - 1)}
                    >
                      <FiChevronRight />
                    </button>
                    <span>{activitiesPagination.page} / {activitiesPagination.totalPages}</span>
                    <button 
                      disabled={activitiesPagination.page >= activitiesPagination.totalPages}
                      onClick={() => loadActivities(activitiesPagination.page + 1)}
                    >
                      <FiChevronLeft />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && currentUser?.role === 'super_admin' && (
              <div className="system-tab">
                <h3>إدارة النظام</h3>
                
                <div className="system-section">
                  <h4>النسخ الاحتياطية</h4>
                  <button className="backup-btn" onClick={createBackup}>
                    <FiDownload /> إنشاء نسخة احتياطية
                  </button>
                  
                  <div className="backups-list">
                    {backups.map((backup, idx) => (
                      <div key={idx} className="backup-item">
                        <FiDatabase />
                        <span className="backup-name">{backup.name}</span>
                        <span className="backup-size">{formatSize(backup.size)}</span>
                        <span className="backup-date">{formatDate(backup.created)}</span>
                      </div>
                    ))}
                    
                    {backups.length === 0 && (
                      <p className="no-backups">لا توجد نسخ احتياطية</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create User Modal */}
        {showUserModal && (
          <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>إضافة مستخدم جديد</h3>
                <button onClick={() => setShowUserModal(false)}><FiX /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>اسم المستخدم *</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="اسم المستخدم"
                  />
                </div>
                <div className="form-group">
                  <label>البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="البريد الإلكتروني"
                  />
                </div>
                <div className="form-group">
                  <label>كلمة المرور *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="كلمة المرور"
                  />
                </div>
                <div className="form-group">
                  <label>الاسم الظاهر</label>
                  <input
                    type="text"
                    value={userForm.displayName}
                    onChange={e => setUserForm({ ...userForm, displayName: e.target.value })}
                    placeholder="الاسم الظاهر"
                  />
                </div>
                <div className="form-group">
                  <label>الدور</label>
                  <select
                    value={userForm.role}
                    onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    <option value="user">مستخدم</option>
                    <option value="admin">مدير</option>
                    {currentUser?.role === 'super_admin' && (
                      <option value="super_admin">مدير أعلى</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowUserModal(false)}>إلغاء</button>
                <button className="submit-btn" onClick={createUser}>إنشاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {selectedUser && (
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>تعديل المستخدم: {selectedUser.username}</h3>
                <button onClick={() => setSelectedUser(null)}><FiX /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>الاسم الظاهر</label>
                  <input
                    type="text"
                    defaultValue={selectedUser.displayName}
                    id="edit-displayName"
                    placeholder="الاسم الظاهر"
                  />
                </div>
                <div className="form-group">
                  <label>الدور</label>
                  <select defaultValue={selectedUser.role} id="edit-role">
                    <option value="user">مستخدم</option>
                    <option value="admin">مدير</option>
                    {currentUser?.role === 'super_admin' && (
                      <option value="super_admin">مدير أعلى</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setSelectedUser(null)}>إلغاء</button>
                <button 
                  className="submit-btn" 
                  onClick={() => {
                    const displayName = document.getElementById('edit-displayName').value;
                    const role = document.getElementById('edit-role').value;
                    updateUser(selectedUser.id, { displayName, role });
                  }}
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
