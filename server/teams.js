/**
 * Teams & Workspaces Module
 * نظام الفرق ومساحات العمل
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const TEAMS_FILE = path.join(__dirname, '.teams.json');
const MAX_TEAM_MEMBERS = 50;
const MAX_TEAMS_PER_USER = 10;

// Team Roles
const TEAM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

// Team Permissions
const TEAM_PERMISSIONS = {
  [TEAM_ROLES.OWNER]: ['*'], // All permissions
  [TEAM_ROLES.ADMIN]: [
    'files:read', 'files:write', 'files:delete', 'files:share',
    'folders:create', 'folders:delete',
    'members:invite', 'members:remove', 'members:edit',
    'settings:view'
  ],
  [TEAM_ROLES.MEMBER]: [
    'files:read', 'files:write', 'files:share',
    'folders:create'
  ],
  [TEAM_ROLES.VIEWER]: [
    'files:read'
  ]
};

// ============ DATA MANAGEMENT ============
let teamsData = { teams: [], invitations: [], activities: [] };

function loadTeams() {
  try {
    if (fs.existsSync(TEAMS_FILE)) {
      teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading teams:', e);
  }
  return teamsData;
}

function saveTeams() {
  try {
    fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamsData, null, 2));
  } catch (e) {
    console.error('Error saving teams:', e);
  }
}

// ============ TEAM CRUD ============

/**
 * Create a new team
 */
function createTeam({ name, description, ownerId, ownerName, color = '#1a73e8', icon = 'users' }) {
  loadTeams();

  if (!name || name.trim().length < 2) {
    throw new Error('اسم الفريق يجب أن يكون حرفين على الأقل');
  }

  if (name.length > 50) {
    throw new Error('اسم الفريق طويل جداً');
  }

  // Check user's team limit
  const userTeams = teamsData.teams.filter(t => 
    t.members.some(m => m.userId === ownerId)
  );
  if (userTeams.length >= MAX_TEAMS_PER_USER) {
    throw new Error(`لا يمكنك الانضمام لأكثر من ${MAX_TEAMS_PER_USER} فرق`);
  }

  const team = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description?.trim() || '',
    color,
    icon,
    ownerId,
    members: [{
      userId: ownerId,
      username: ownerName,
      role: TEAM_ROLES.OWNER,
      joinedAt: new Date().toISOString()
    }],
    settings: {
      allowMemberInvites: false,
      defaultMemberRole: TEAM_ROLES.MEMBER,
      storageLimit: -1, // Unlimited
      notifyOnActivity: true
    },
    storageUsed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  teamsData.teams.push(team);
  saveTeams();

  logActivity(team.id, ownerId, 'team_created', { teamName: team.name });

  return team;
}

/**
 * Get team by ID
 */
function getTeam(teamId) {
  loadTeams();
  return teamsData.teams.find(t => t.id === teamId);
}

/**
 * Get user's teams
 */
function getUserTeams(userId) {
  loadTeams();
  return teamsData.teams.filter(t => 
    t.members.some(m => m.userId === userId)
  ).map(t => ({
    ...t,
    memberCount: t.members.length,
    userRole: t.members.find(m => m.userId === userId)?.role
  }));
}

/**
 * Update team
 */
function updateTeam(teamId, updates, userId) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  // Check permission
  const member = team.members.find(m => m.userId === userId);
  if (!member || (member.role !== TEAM_ROLES.OWNER && member.role !== TEAM_ROLES.ADMIN)) {
    throw new Error('ليس لديك صلاحية لتعديل الفريق');
  }

  // Update allowed fields
  const allowedFields = ['name', 'description', 'color', 'icon', 'settings'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      team[field] = updates[field];
    }
  }

  team.updatedAt = new Date().toISOString();
  saveTeams();

  logActivity(teamId, userId, 'team_updated', { changes: Object.keys(updates) });

  return team;
}

/**
 * Delete team
 */
function deleteTeam(teamId, userId) {
  loadTeams();

  const teamIndex = teamsData.teams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) {
    throw new Error('الفريق غير موجود');
  }

  const team = teamsData.teams[teamIndex];

  // Only owner can delete
  if (team.ownerId !== userId) {
    throw new Error('فقط مالك الفريق يمكنه حذفه');
  }

  teamsData.teams.splice(teamIndex, 1);

  // Remove related invitations
  teamsData.invitations = teamsData.invitations.filter(i => i.teamId !== teamId);

  saveTeams();

  return true;
}

// ============ MEMBER MANAGEMENT ============

/**
 * Add member to team
 */
function addMember(teamId, userId, username, role = TEAM_ROLES.MEMBER, addedBy) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  // Check if already member
  if (team.members.some(m => m.userId === userId)) {
    throw new Error('المستخدم عضو بالفعل في الفريق');
  }

  // Check member limit
  if (team.members.length >= MAX_TEAM_MEMBERS) {
    throw new Error(`الفريق وصل للحد الأقصى (${MAX_TEAM_MEMBERS} عضو)`);
  }

  // Check user's team limit
  const userTeams = teamsData.teams.filter(t => 
    t.members.some(m => m.userId === userId)
  );
  if (userTeams.length >= MAX_TEAMS_PER_USER) {
    throw new Error('المستخدم وصل للحد الأقصى من الفرق');
  }

  team.members.push({
    userId,
    username,
    role,
    joinedAt: new Date().toISOString(),
    addedBy
  });

  team.updatedAt = new Date().toISOString();
  saveTeams();

  logActivity(teamId, addedBy, 'member_added', { memberId: userId, memberName: username });

  return team;
}

/**
 * Remove member from team
 */
function removeMember(teamId, userId, removedBy) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  const memberIndex = team.members.findIndex(m => m.userId === userId);
  if (memberIndex === -1) {
    throw new Error('المستخدم ليس عضواً في الفريق');
  }

  const member = team.members[memberIndex];

  // Can't remove owner
  if (member.role === TEAM_ROLES.OWNER) {
    throw new Error('لا يمكن إزالة مالك الفريق');
  }

  // Check permission
  const remover = team.members.find(m => m.userId === removedBy);
  if (!remover) {
    throw new Error('ليس لديك صلاحية');
  }

  // Only owner/admin can remove others, members can remove themselves
  if (userId !== removedBy && remover.role !== TEAM_ROLES.OWNER && remover.role !== TEAM_ROLES.ADMIN) {
    throw new Error('ليس لديك صلاحية لإزالة الأعضاء');
  }

  team.members.splice(memberIndex, 1);
  team.updatedAt = new Date().toISOString();
  saveTeams();

  logActivity(teamId, removedBy, 'member_removed', { memberId: userId, memberName: member.username });

  return team;
}

/**
 * Update member role
 */
function updateMemberRole(teamId, userId, newRole, updatedBy) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  const member = team.members.find(m => m.userId === userId);
  if (!member) {
    throw new Error('المستخدم ليس عضواً في الفريق');
  }

  // Can't change owner role
  if (member.role === TEAM_ROLES.OWNER) {
    throw new Error('لا يمكن تغيير دور المالك');
  }

  // Only owner can change roles
  const updater = team.members.find(m => m.userId === updatedBy);
  if (!updater || updater.role !== TEAM_ROLES.OWNER) {
    throw new Error('فقط المالك يمكنه تغيير الأدوار');
  }

  // Can't make someone else owner
  if (newRole === TEAM_ROLES.OWNER) {
    throw new Error('استخدم نقل الملكية لتغيير المالك');
  }

  member.role = newRole;
  team.updatedAt = new Date().toISOString();
  saveTeams();

  logActivity(teamId, updatedBy, 'role_changed', { memberId: userId, newRole });

  return team;
}

/**
 * Transfer ownership
 */
function transferOwnership(teamId, newOwnerId, currentOwnerId) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  if (team.ownerId !== currentOwnerId) {
    throw new Error('فقط المالك الحالي يمكنه نقل الملكية');
  }

  const newOwner = team.members.find(m => m.userId === newOwnerId);
  if (!newOwner) {
    throw new Error('المستخدم الجديد ليس عضواً في الفريق');
  }

  // Update roles
  const currentOwner = team.members.find(m => m.userId === currentOwnerId);
  currentOwner.role = TEAM_ROLES.ADMIN;
  newOwner.role = TEAM_ROLES.OWNER;
  team.ownerId = newOwnerId;
  team.updatedAt = new Date().toISOString();

  saveTeams();

  logActivity(teamId, currentOwnerId, 'ownership_transferred', { newOwnerId });

  return team;
}

// ============ INVITATIONS ============

/**
 * Create invitation
 */
function createInvitation(teamId, email, role, invitedBy) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error('الفريق غير موجود');
  }

  // Check permission
  const inviter = team.members.find(m => m.userId === invitedBy);
  if (!inviter) {
    throw new Error('ليس لديك صلاحية');
  }

  if (inviter.role !== TEAM_ROLES.OWNER && inviter.role !== TEAM_ROLES.ADMIN) {
    if (!team.settings.allowMemberInvites) {
      throw new Error('ليس لديك صلاحية لدعوة أعضاء');
    }
  }

  // Check if already invited
  const existingInvite = teamsData.invitations.find(i => 
    i.teamId === teamId && i.email === email.toLowerCase() && i.status === 'pending'
  );
  if (existingInvite) {
    throw new Error('تم إرسال دعوة لهذا البريد مسبقاً');
  }

  const invitation = {
    id: crypto.randomUUID(),
    teamId,
    teamName: team.name,
    email: email.toLowerCase(),
    role: role || team.settings.defaultMemberRole,
    invitedBy,
    inviterName: inviter.username,
    token: crypto.randomBytes(32).toString('hex'),
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };

  teamsData.invitations.push(invitation);
  saveTeams();

  logActivity(teamId, invitedBy, 'invitation_sent', { email });

  return invitation;
}

/**
 * Accept invitation
 */
function acceptInvitation(token, userId, username) {
  loadTeams();

  const invitation = teamsData.invitations.find(i => i.token === token);
  if (!invitation) {
    throw new Error('الدعوة غير موجودة');
  }

  if (invitation.status !== 'pending') {
    throw new Error('الدعوة غير صالحة');
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = 'expired';
    saveTeams();
    throw new Error('انتهت صلاحية الدعوة');
  }

  // Add member
  addMember(invitation.teamId, userId, username, invitation.role, invitation.invitedBy);

  // Update invitation
  invitation.status = 'accepted';
  invitation.acceptedAt = new Date().toISOString();
  invitation.acceptedBy = userId;

  saveTeams();

  return getTeam(invitation.teamId);
}

/**
 * Decline invitation
 */
function declineInvitation(token) {
  loadTeams();

  const invitation = teamsData.invitations.find(i => i.token === token);
  if (!invitation) {
    throw new Error('الدعوة غير موجودة');
  }

  invitation.status = 'declined';
  invitation.declinedAt = new Date().toISOString();

  saveTeams();

  return true;
}

/**
 * Get pending invitations for user
 */
function getUserInvitations(email) {
  loadTeams();
  return teamsData.invitations.filter(i => 
    i.email === email.toLowerCase() && 
    i.status === 'pending' &&
    new Date(i.expiresAt) > new Date()
  );
}

/**
 * Get team invitations
 */
function getTeamInvitations(teamId) {
  loadTeams();
  return teamsData.invitations.filter(i => i.teamId === teamId);
}

/**
 * Cancel invitation
 */
function cancelInvitation(invitationId, userId) {
  loadTeams();

  const invitation = teamsData.invitations.find(i => i.id === invitationId);
  if (!invitation) {
    throw new Error('الدعوة غير موجودة');
  }

  const team = teamsData.teams.find(t => t.id === invitation.teamId);
  const member = team?.members.find(m => m.userId === userId);

  if (!member || (member.role !== TEAM_ROLES.OWNER && member.role !== TEAM_ROLES.ADMIN)) {
    throw new Error('ليس لديك صلاحية');
  }

  invitation.status = 'cancelled';
  invitation.cancelledAt = new Date().toISOString();
  invitation.cancelledBy = userId;

  saveTeams();

  return true;
}

// ============ PERMISSIONS ============

/**
 * Check if user has permission in team
 */
function hasPermission(teamId, userId, permission) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) return false;

  const member = team.members.find(m => m.userId === userId);
  if (!member) return false;

  const rolePermissions = TEAM_PERMISSIONS[member.role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
}

/**
 * Get user's role in team
 */
function getMemberRole(teamId, userId) {
  loadTeams();

  const team = teamsData.teams.find(t => t.id === teamId);
  if (!team) return null;

  const member = team.members.find(m => m.userId === userId);
  return member?.role || null;
}

// ============ ACTIVITY LOG ============

/**
 * Log team activity
 */
function logActivity(teamId, userId, action, data = {}) {
  teamsData.activities.push({
    id: crypto.randomUUID(),
    teamId,
    userId,
    action,
    data,
    createdAt: new Date().toISOString()
  });

  // Keep only last 1000 activities per team
  const teamActivities = teamsData.activities.filter(a => a.teamId === teamId);
  if (teamActivities.length > 1000) {
    const toRemove = teamActivities.slice(0, teamActivities.length - 1000);
    teamsData.activities = teamsData.activities.filter(a => !toRemove.includes(a));
  }

  saveTeams();
}

/**
 * Get team activity
 */
function getTeamActivity(teamId, limit = 50) {
  loadTeams();
  return teamsData.activities
    .filter(a => a.teamId === teamId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ============ EXPORTS ============
module.exports = {
  // Constants
  TEAM_ROLES,
  TEAM_PERMISSIONS,
  MAX_TEAM_MEMBERS,
  MAX_TEAMS_PER_USER,

  // Team CRUD
  createTeam,
  getTeam,
  getUserTeams,
  updateTeam,
  deleteTeam,

  // Members
  addMember,
  removeMember,
  updateMemberRole,
  transferOwnership,

  // Invitations
  createInvitation,
  acceptInvitation,
  declineInvitation,
  getUserInvitations,
  getTeamInvitations,
  cancelInvitation,

  // Permissions
  hasPermission,
  getMemberRole,

  // Activity
  logActivity,
  getTeamActivity
};
