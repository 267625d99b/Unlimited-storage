/**
 * Admin Routes
 * مسارات لوحة التحكم
 */

const express = require('express');
const router = express.Router();
const users = require('../users');
const db = require('../database');

// All admin routes require authentication and admin role
router.use(users.authMiddleware);
router.use(users.requireRole(users.ROLES.SUPER_ADMIN, users.ROLES.ADMIN));

// ============ USER MANAGEMENT ============

// GET /api/admin/users - List all users
router.get('/users', (req, res) => {
  try {
    const { page, limit, role, status, search, sortBy, sortOrder } = req.query;
    const result = users.getAllUsers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      role,
      status,
      search,
      sortBy,
      sortOrder
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/users - Create new user
router.post('/users', users.requirePermission(users.PERMISSIONS.USER_CREATE), async (req, res) => {
  try {
    const { username, email, password, displayName, role } = req.body;
    
    // Only super admin can create admins
    if (role === users.ROLES.SUPER_ADMIN && req.user.role !== users.ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'لا يمكنك إنشاء مدير أعلى' });
    }
    
    const user = await users.createUser({
      username,
      email,
      password,
      displayName,
      role: role || users.ROLES.USER
    });
    
    db.logActivity(req.user.userId, 'admin_create_user', 'user', user.id, user.username, { role }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', (req, res) => {
  try {
    const user = users.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    const storage = users.getUserStorageInfo(req.params.id);
    const sessions = users.getUserSessions(req.params.id);
    
    res.json({ user, storage, sessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id - Update user
router.patch('/users/:id', users.requirePermission(users.PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const { displayName, role, status, storageLimit } = req.body;
    const targetUser = users.getUser(req.params.id);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    // Only super admin can modify admins
    if (targetUser.role === users.ROLES.SUPER_ADMIN && req.user.role !== users.ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'لا يمكنك تعديل مدير أعلى' });
    }
    
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    if (status) updates.status = status;
    
    const user = await users.updateUser(req.params.id, updates);
    
    db.logActivity(req.user.userId, 'admin_update_user', 'user', user.id, user.username, updates, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', users.requirePermission(users.PERMISSIONS.USER_DELETE), (req, res) => {
  try {
    const targetUser = users.getUser(req.params.id);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    // Can't delete yourself
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك' });
    }
    
    // Only super admin can delete admins
    if (targetUser.role === users.ROLES.SUPER_ADMIN && req.user.role !== users.ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'لا يمكنك حذف مدير أعلى' });
    }
    
    users.deleteUser(req.params.id);
    
    db.logActivity(req.user.userId, 'admin_delete_user', 'user', req.params.id, targetUser.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/reset-password - Reset user password
router.post('/users/:id/reset-password', users.requirePermission(users.PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const targetUser = users.getUser(req.params.id);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    await users.resetPassword(req.params.id, newPassword);
    
    db.logActivity(req.user.userId, 'admin_reset_password', 'user', req.params.id, targetUser.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/users/:id/suspend', users.requirePermission(users.PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const targetUser = users.getUser(req.params.id);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    await users.updateUser(req.params.id, { status: 'suspended' });
    users.logoutAllDevices(req.params.id);
    
    db.logActivity(req.user.userId, 'admin_suspend_user', 'user', req.params.id, targetUser.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم إيقاف الحساب' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/activate - Activate user
router.post('/users/:id/activate', users.requirePermission(users.PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const targetUser = users.getUser(req.params.id);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    await users.updateUser(req.params.id, { status: 'active' });
    
    db.logActivity(req.user.userId, 'admin_activate_user', 'user', req.params.id, targetUser.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم تفعيل الحساب' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ ACTIVITY LOGS ============

// GET /api/admin/activity - Get all activity logs
router.get('/activity', users.requirePermission(users.PERMISSIONS.ADMIN_LOGS), (req, res) => {
  try {
    const { page, limit, userId, action, targetType } = req.query;
    const result = db.getActivityLog({
      userId,
      action,
      targetType,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 100
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ STATISTICS ============

// GET /api/admin/stats - Get system statistics
router.get('/stats', (req, res) => {
  try {
    const allUsers = users.getAllUsers({ limit: 10000 });
    const dbStats = db.getStats();
    
    const stats = {
      users: {
        total: allUsers.pagination.total,
        byRole: {
          superAdmin: allUsers.users.filter(u => u.role === users.ROLES.SUPER_ADMIN).length,
          admin: allUsers.users.filter(u => u.role === users.ROLES.ADMIN).length,
          user: allUsers.users.filter(u => u.role === users.ROLES.USER).length,
          guest: allUsers.users.filter(u => u.role === users.ROLES.GUEST).length
        },
        byStatus: {
          active: allUsers.users.filter(u => u.status === 'active').length,
          suspended: allUsers.users.filter(u => u.status === 'suspended').length
        }
      },
      storage: {
        totalFiles: dbStats.files,
        totalFolders: dbStats.folders,
        totalSize: dbStats.totalSize,
        trashItems: dbStats.trash
      },
      cache: db.getCacheStats()
    };
    
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ SYSTEM ============

// GET /api/admin/backups - List backups
router.get('/backups', users.requireRole(users.ROLES.SUPER_ADMIN), (req, res) => {
  try {
    const backups = db.listBackups();
    res.json({ backups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/backups - Create backup
router.post('/backups', users.requireRole(users.ROLES.SUPER_ADMIN), (req, res) => {
  try {
    const backupPath = db.createBackup();
    db.logActivity(req.user.userId, 'create_backup', 'system', null, null, { path: backupPath }, req.ip, req.headers['user-agent']);
    res.json({ success: true, path: backupPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/assign-orphan-files - Assign files without user_id to current admin
router.post('/assign-orphan-files', users.requireRole(users.ROLES.SUPER_ADMIN), (req, res) => {
  try {
    const result = db.assignOrphanFilesToUser(req.user.userId);
    db.logActivity(req.user.userId, 'assign_orphan_files', 'system', null, null, result, req.ip, req.headers['user-agent']);
    res.json({ 
      success: true, 
      message: `تم ربط ${result.files} ملف و ${result.folders} مجلد و ${result.trash} عنصر محذوف بحسابك`,
      ...result 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/unlock - Unlock user account
router.post('/users/:id/unlock', users.requirePermission(users.PERMISSIONS.USER_EDIT), (req, res) => {
  try {
    users.unlockAccount(req.params.id);
    db.logActivity(req.user.userId, 'admin_unlock_user', 'user', req.params.id, null, null, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'تم فك قفل الحساب' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
