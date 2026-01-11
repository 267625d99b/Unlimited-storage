const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SHARES_FILE = path.join(__dirname, '.shares.json');
const SHARE_PERMISSIONS = { VIEW: 'view', DOWNLOAD: 'download', EDIT: 'edit', ADMIN: 'admin' };
const PERMISSION_LEVELS = { view: 1, download: 2, edit: 3, admin: 4 };
let sharesData = { shares: [], publicLinks: [], shareActivities: [] };
function loadShares() { try { if (fs.existsSync(SHARES_FILE)) sharesData = JSON.parse(fs.readFileSync(SHARES_FILE, 'utf8')); } catch (e) {} return sharesData; }
function saveShares() { try { fs.writeFileSync(SHARES_FILE, JSON.stringify(sharesData, null, 2)); } catch (e) {} }
loadShares();
function shareWithUser(o) { loadShares(); const { itemId, itemType, itemName, ownerId, ownerName, targetUserId, targetUserName, targetEmail, permission = 'view', message = '' } = o; const share = { id: crypto.randomUUID(), itemId, itemType, itemName, ownerId, ownerName, targetUserId, targetUserName, targetEmail, permission, message, status: 'active', createdAt: new Date().toISOString() }; sharesData.shares.push(share); saveShares(); return share; }
function getSharedWithMe(userId) { loadShares(); return sharesData.shares.filter(s => s.targetUserId === userId && s.status === 'active'); }
function getSharedByMe(userId) { loadShares(); return sharesData.shares.filter(s => s.ownerId === userId && s.status === 'active'); }
function checkPermission(itemId, userId, req) { loadShares(); const s = sharesData.shares.find(x => x.itemId === itemId && x.targetUserId === userId && x.status === 'active'); return s ? (PERMISSION_LEVELS[s.permission] || 0) >= (PERMISSION_LEVELS[req] || 0) : false; }
function hashPassword(p) { return crypto.createHash('sha256').update(p).digest('hex'); }
function createPublicLink(o) { loadShares(); const { itemId, itemType, itemName, ownerId, ownerName, permission = 'view', password = null, maxDownloads = null } = o; const link = { id: crypto.randomUUID(), token: crypto.randomBytes(32).toString('hex'), shortCode: crypto.randomBytes(4).toString('hex').toUpperCase(), itemId, itemType, itemName, ownerId, ownerName, permission, password: password ? hashPassword(password) : null, maxDownloads, downloadCount: 0, status: 'active', views: 0, accessLog: [], createdAt: new Date().toISOString() }; sharesData.publicLinks.push(link); saveShares(); return link; }
function accessPublicLink(code, o = {}) { loadShares(); const { password = null } = o; const link = sharesData.publicLinks.find(l => (l.token === code || l.shortCode === code) && l.status === 'active'); if (!link) return { success: false, error: 'not found' }; if (link.password && link.password !== hashPassword(password || '')) return { success: false, requirePassword: true }; link.views++; saveShares(); return { success: true, link: { id: link.id, itemId: link.itemId, itemName: link.itemName, permission: link.permission } }; }
function getUserPublicLinks(userId) { loadShares(); return sharesData.publicLinks.filter(l => l.ownerId === userId); }
function getLinkStats(linkId, userId) { loadShares(); const l = sharesData.publicLinks.find(x => x.id === linkId); return l ? { totalViews: l.views, totalDownloads: l.downloadCount } : null; }
function requestAccess(o) { loadShares(); const r = { id: crypto.randomUUID(), action: 'access_requested', userId: o.requesterId, data: { ...o, status: 'pending' }, timestamp: new Date().toISOString() }; sharesData.shareActivities.push(r); saveShares(); return r; }
function getPendingAccessRequests(userId) { loadShares(); return sharesData.shareActivities.filter(a => a.action === 'access_requested' && a.data.ownerId === userId && a.data.status === 'pending'); }
module.exports = { SHARE_PERMISSIONS, PERMISSION_LEVELS, shareWithUser, getSharedWithMe, getSharedByMe, checkPermission, createPublicLink, accessPublicLink, getUserPublicLinks, getLinkStats, requestAccess, getPendingAccessRequests };
