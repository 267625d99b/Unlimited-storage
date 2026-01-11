/**
 * Teams Routes
 * مسارات الفرق ومساحات العمل
 */

const express = require('express');
const router = express.Router();
const teams = require('../teams');
const notifications = require('../notifications');

// ============ TEAM CRUD ============

/**
 * Create team
 * POST /api/teams
 */
router.post('/', (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'اسم الفريق مطلوب (حرفين على الأقل)' });
    }

    const team = teams.createTeam({
      name,
      description,
      ownerId: req.user.id,
      ownerName: req.user.username,
      color,
      icon
    });

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get my teams
 * GET /api/teams
 */
router.get('/', (req, res) => {
  const userTeams = teams.getUserTeams(req.user.id);
  res.json({ teams: userTeams });
});

/**
 * Get team by ID
 * GET /api/teams/:teamId
 */
router.get('/:teamId', (req, res) => {
  const team = teams.getTeam(req.params.teamId);
  
  if (!team) {
    return res.status(404).json({ error: 'الفريق غير موجود' });
  }

  // Check if user is member
  const isMember = team.members.some(m => m.userId === req.user.id);
  if (!isMember) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا الفريق' });
  }

  res.json({ team });
});

/**
 * Update team
 * PUT /api/teams/:teamId
 */
router.put('/:teamId', (req, res) => {
  try {
    const team = teams.updateTeam(req.params.teamId, req.body, req.user.id);
    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Delete team
 * DELETE /api/teams/:teamId
 */
router.delete('/:teamId', (req, res) => {
  try {
    teams.deleteTeam(req.params.teamId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ MEMBERS ============

/**
 * Add member to team
 * POST /api/teams/:teamId/members
 */
router.post('/:teamId/members', (req, res) => {
  try {
    const { userId, username, role } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: 'معرف المستخدم واسمه مطلوبان' });
    }

    const team = teams.addMember(
      req.params.teamId,
      userId,
      username,
      role || teams.TEAM_ROLES.MEMBER,
      req.user.id
    );

    // Notify new member
    notifications.createNotification({
      userId,
      type: 'team_added',
      title: 'تمت إضافتك لفريق',
      message: `تمت إضافتك إلى فريق "${team.name}"`,
      data: { teamId: team.id, teamName: team.name }
    });

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Remove member from team
 * DELETE /api/teams/:teamId/members/:userId
 */
router.delete('/:teamId/members/:userId', (req, res) => {
  try {
    const team = teams.removeMember(
      req.params.teamId,
      req.params.userId,
      req.user.id
    );

    // Notify removed member (if not self-removal)
    if (req.params.userId !== req.user.id) {
      notifications.createNotification({
        userId: req.params.userId,
        type: 'team_removed',
        title: 'تمت إزالتك من فريق',
        message: `تمت إزالتك من فريق "${team.name}"`,
        data: { teamId: team.id, teamName: team.name }
      });
    }

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Update member role
 * PUT /api/teams/:teamId/members/:userId/role
 */
router.put('/:teamId/members/:userId/role', (req, res) => {
  try {
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'الدور مطلوب' });
    }

    const team = teams.updateMemberRole(
      req.params.teamId,
      req.params.userId,
      role,
      req.user.id
    );

    // Notify member
    notifications.createNotification({
      userId: req.params.userId,
      type: 'role_changed',
      title: 'تم تغيير دورك',
      message: `تم تغيير دورك في فريق "${team.name}" إلى ${role}`,
      data: { teamId: team.id, newRole: role }
    });

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Transfer ownership
 * POST /api/teams/:teamId/transfer-ownership
 */
router.post('/:teamId/transfer-ownership', (req, res) => {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ error: 'معرف المالك الجديد مطلوب' });
    }

    const team = teams.transferOwnership(
      req.params.teamId,
      newOwnerId,
      req.user.id
    );

    // Notify new owner
    notifications.createNotification({
      userId: newOwnerId,
      type: 'ownership_transferred',
      title: 'أصبحت مالك الفريق',
      message: `تم نقل ملكية فريق "${team.name}" إليك`,
      data: { teamId: team.id },
      priority: 'high'
    });

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ INVITATIONS ============

/**
 * Create invitation
 * POST /api/teams/:teamId/invitations
 */
router.post('/:teamId/invitations', (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    const invitation = teams.createInvitation(
      req.params.teamId,
      email,
      role,
      req.user.id
    );

    // TODO: Send email invitation
    // emailService.sendTeamInvitation(email, invitation);

    res.json({ success: true, invitation });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get team invitations
 * GET /api/teams/:teamId/invitations
 */
router.get('/:teamId/invitations', (req, res) => {
  try {
    // Check permission
    const role = teams.getMemberRole(req.params.teamId, req.user.id);
    if (!role || (role !== teams.TEAM_ROLES.OWNER && role !== teams.TEAM_ROLES.ADMIN)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }

    const invitations = teams.getTeamInvitations(req.params.teamId);
    res.json({ invitations });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Cancel invitation
 * DELETE /api/teams/:teamId/invitations/:invitationId
 */
router.delete('/:teamId/invitations/:invitationId', (req, res) => {
  try {
    teams.cancelInvitation(req.params.invitationId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get my pending invitations
 * GET /api/teams/invitations/pending
 */
router.get('/invitations/pending', (req, res) => {
  const invitations = teams.getUserInvitations(req.user.email);
  res.json({ invitations });
});

/**
 * Accept invitation
 * POST /api/teams/invitations/:token/accept
 */
router.post('/invitations/:token/accept', (req, res) => {
  try {
    const team = teams.acceptInvitation(
      req.params.token,
      req.user.id,
      req.user.username
    );

    res.json({ success: true, team });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Decline invitation
 * POST /api/teams/invitations/:token/decline
 */
router.post('/invitations/:token/decline', (req, res) => {
  try {
    teams.declineInvitation(req.params.token);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ ACTIVITY ============

/**
 * Get team activity
 * GET /api/teams/:teamId/activity
 */
router.get('/:teamId/activity', (req, res) => {
  try {
    // Check if user is member
    const role = teams.getMemberRole(req.params.teamId, req.user.id);
    if (!role) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const activity = teams.getTeamActivity(req.params.teamId, limit);
    res.json({ activity });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ PERMISSIONS ============

/**
 * Check permission
 * GET /api/teams/:teamId/permissions/:permission
 */
router.get('/:teamId/permissions/:permission', (req, res) => {
  const hasPermission = teams.hasPermission(
    req.params.teamId,
    req.user.id,
    req.params.permission
  );
  res.json({ hasPermission });
});

module.exports = router;
