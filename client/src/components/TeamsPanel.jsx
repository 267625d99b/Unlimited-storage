import { useState, useEffect } from 'react';
import { Users, Plus, Settings, UserPlus, Crown, Shield, Eye, Trash2, LogOut, Mail, Check, X, ChevronDown, Activity } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function TeamsPanel({ token, currentUser }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);

  // Create team form
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#1a73e8');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const TEAM_COLORS = [
    '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0',
    '#00bcd4', '#ff5722', '#795548', '#607d8b', '#e91e63'
  ];

  useEffect(() => {
    fetchTeams();
    fetchPendingInvitations();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamActivity(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (e) {
      // Error handled by UI
    }
    setLoading(false);
  };

  const fetchPendingInvitations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams/invitations/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPendingInvitations(data.invitations || []);
    } catch (e) {
      // Error handled by UI
    }
  };

  const fetchTeamActivity = async (teamId) => {
    try {
      const res = await fetch(`${API_URL}/api/teams/${teamId}/activity?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setActivity(data.activity || []);
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription,
          color: newTeamColor
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTeamName('');
        setNewTeamDescription('');
        fetchTeams();
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      const res = await fetch(`${API_URL}/api/teams/${selectedTeam.id}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteEmail('');
      }
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleAcceptInvitation = async (token_inv) => {
    try {
      await fetch(`${API_URL}/api/teams/invitations/${token_inv}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTeams();
      fetchPendingInvitations();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleDeclineInvitation = async (token_inv) => {
    try {
      await fetch(`${API_URL}/api/teams/invitations/${token_inv}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPendingInvitations();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedTeam) return;
    
    try {
      await fetch(`${API_URL}/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTeams();
      setSelectedTeam(teams.find(t => t.id === selectedTeam.id));
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleLeaveTeam = async () => {
    if (!selectedTeam) return;
    
    try {
      await fetch(`${API_URL}/api/teams/${selectedTeam.id}/members/${currentUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTeam(null);
      fetchTeams();
    } catch (e) {
      // Error handled by UI
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam || !confirm('هل أنت متأكد من حذف هذا الفريق؟')) return;
    
    try {
      await fetch(`${API_URL}/api/teams/${selectedTeam.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTeam(null);
      fetchTeams();
    } catch (e) {
      // Error handled by UI
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'member': return <Users className="w-4 h-4 text-gray-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-400" />;
      default: return null;
    }
  };

  const getRoleLabel = (role) => {
    const labels = { owner: 'مالك', admin: 'مدير', member: 'عضو', viewer: 'مشاهد' };
    return labels[role] || role;
  };

  return (
    <div className="flex h-full">
      {/* Teams List */}
      <div className="w-64 border-l dark:border-gray-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">الفرق</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500">دعوات معلقة</h3>
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                <p className="font-medium">{inv.teamName}</p>
                <p className="text-xs text-gray-500">من {inv.inviterName}</p>
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => handleAcceptInvitation(inv.token)}
                    className="flex-1 px-2 py-1 bg-green-500 text-white rounded text-xs"
                  >
                    قبول
                  </button>
                  <button
                    onClick={() => handleDeclineInvitation(inv.token)}
                    className="flex-1 px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs"
                  >
                    رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Teams */}
        <div className="space-y-1">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">جاري التحميل...</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد فرق</p>
          ) : (
            teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-right ${
                  selectedTeam?.id === team.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: team.color }}
                >
                  {team.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{team.name}</p>
                  <p className="text-xs text-gray-500">{team.memberCount} أعضاء</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Team Details */}
      <div className="flex-1 p-6">
        {selectedTeam ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: selectedTeam.color }}
                >
                  {selectedTeam.name[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{selectedTeam.name}</h1>
                  <p className="text-gray-500">{selectedTeam.description || 'لا يوجد وصف'}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    دورك: {getRoleLabel(selectedTeam.userRole)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(selectedTeam.userRole === 'owner' || selectedTeam.userRole === 'admin') && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus className="w-4 h-4" />
                    دعوة
                  </button>
                )}
                {selectedTeam.userRole !== 'owner' && (
                  <button
                    onClick={handleLeaveTeam}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    مغادرة
                  </button>
                )}
                {selectedTeam.userRole === 'owner' && (
                  <button
                    onClick={handleDeleteTeam}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف
                  </button>
                )}
              </div>
            </div>

            {/* Members */}
            <div>
              <h2 className="text-lg font-semibold mb-3">الأعضاء ({selectedTeam.members?.length || 0})</h2>
              <div className="grid gap-2">
                {selectedTeam.members?.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="font-medium">{member.username?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium">{member.username}</p>
                        <p className="text-xs text-gray-500">
                          انضم {new Date(member.joinedAt).toLocaleDateString('ar')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm">
                        {getRoleIcon(member.role)}
                        {getRoleLabel(member.role)}
                      </span>
                      {selectedTeam.userRole === 'owner' && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                النشاط الأخير
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لا يوجد نشاط</p>
                ) : (
                  activity.map((act) => (
                    <div key={act.id} className="flex items-center gap-3 p-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-gray-500">
                        {new Date(act.createdAt).toLocaleString('ar')}
                      </span>
                      <span>{act.action}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Users className="w-16 h-16 mb-4" />
            <p>اختر فريقاً أو أنشئ فريقاً جديداً</p>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">إنشاء فريق جديد</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الفريق</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوصف</label>
                <textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">اللون</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAM_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTeamColor(color)}
                      className={`w-8 h-8 rounded-lg ${newTeamColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                      style={{ backgroundColor: color }}
                    />
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  إنشاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">دعوة عضو جديد</h2>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الدور</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="viewer">مشاهد</option>
                  <option value="member">عضو</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Mail className="w-4 h-4 inline ml-2" />
                  إرسال الدعوة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
