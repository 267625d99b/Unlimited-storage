# API Documentation - توثيق API

## 📚 Swagger UI

الوصول لتوثيق API التفاعلي:

```
http://localhost:3000/api-docs
```

---

## 🔐 Authentication

### تسجيل الدخول

```http
POST /api/users/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900
}
```

### تجديد التوكن

```http
POST /api/users/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

---

## 📁 Files

### قائمة الملفات

```http
GET /api/files?folderId=null&page=1&limit=50
Authorization: Bearer {token}
```

### رفع ملف

```http
POST /api/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary)
folderId: (optional)
```

### تحميل ملف

```http
GET /api/download-file/{id}
Authorization: Bearer {token}
```

### حذف ملف

```http
DELETE /api/files/{id}
Authorization: Bearer {token}
```

---

## 📂 Folders

### إنشاء مجلد

```http
POST /api/folders
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Folder",
  "parentId": null
}
```

### حذف مجلد

```http
DELETE /api/folders/{id}
Authorization: Bearer {token}
```

---

## 🔍 Search

### بحث بسيط

```http
GET /api/search?q=filename
Authorization: Bearer {token}
```

### بحث متقدم

```http
POST /api/search/advanced
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "document",
  "types": ["document", "image"],
  "minSize": 1024,
  "maxSize": 10485760,
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "starred": true
}
```

---

## 🔗 Sharing

### مشاركة ملف

```http
POST /api/share/file/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "password": "optional",
  "expiresIn": 86400,
  "permissions": "view"
}
```

### الوصول لملف مشارك

```http
GET /api/shared/file/{shareId}?password=optional
```

---

## 👤 User Management

### بيانات المستخدم الحالي

```http
GET /api/users/me
Authorization: Bearer {token}
```

### تغيير كلمة المرور

```http
POST /api/users/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "old",
  "newPassword": "new"
}
```

---

## 🔐 Two-Factor Authentication

### إعداد 2FA

```http
POST /api/auth/2fa/setup
Authorization: Bearer {token}
```

### التحقق من 2FA

```http
POST /api/auth/2fa/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "123456"
}
```

---

## 📊 Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - بيانات غير صالحة |
| 401 | Unauthorized - غير مصرح |
| 403 | Forbidden - ممنوع |
| 404 | Not Found - غير موجود |
| 413 | Payload Too Large - حجم كبير |
| 429 | Too Many Requests - طلبات كثيرة |
| 500 | Internal Server Error - خطأ داخلي |

---

## 🔒 Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 req/15min |
| Upload | 50 req/hour |
| Download | 200 req/15min |
| Login | 10 req/15min |
| 2FA Verify | 5 req/15min |

## 🤝 Advanced Sharing API (المشاركة المتقدمة)

### مشاركة مع مستخدم

```http
POST /api/sharing/share
Authorization: Bearer {token}
Content-Type: application/json

{
  "itemId": "file-uuid",
  "itemType": "file",
  "itemName": "document.pdf",
  "targetUserId": "user-uuid",
  "targetEmail": "user@example.com",
  "permission": "view|download|edit|admin",
  "message": "رسالة اختيارية"
}
```

### إنشاء رابط عام

```http
POST /api/sharing/public-link
Authorization: Bearer {token}
Content-Type: application/json

{
  "itemId": "file-uuid",
  "itemType": "file",
  "itemName": "document.pdf",
  "permission": "view|download",
  "password": "optional-password",
  "expiresAt": "2024-12-31T23:59:59Z",
  "maxDownloads": 100,
  "allowedEmails": ["user1@example.com"],
  "requireLogin": false
}
```

**Response:**
```json
{
  "success": true,
  "link": {
    "id": "link-uuid",
    "shortCode": "ABC123",
    "token": "long-token",
    "url": "https://app.com/s/ABC123"
  }
}
```

### الوصول لرابط عام

```http
GET /api/s/{code}?password=xxx&email=xxx
```

### الملفات المشاركة معي

```http
GET /api/sharing/shared-with-me
Authorization: Bearer {token}
```

### الملفات التي شاركتها

```http
GET /api/sharing/shared-by-me
Authorization: Bearer {token}
```

---

## 👥 Teams API (الفرق)

### إنشاء فريق

```http
POST /api/teams
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "فريق التطوير",
  "description": "وصف الفريق",
  "color": "#1a73e8"
}
```

### الحصول على فرقي

```http
GET /api/teams
Authorization: Bearer {token}
```

### دعوة عضو

```http
POST /api/teams/{teamId}/invitations
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "member@example.com",
  "role": "member|admin|viewer"
}
```

### قبول دعوة

```http
POST /api/teams/invitations/{token}/accept
Authorization: Bearer {token}
```

### أدوار الفريق

| الدور | الصلاحيات |
|-------|----------|
| owner | كل الصلاحيات |
| admin | إدارة الأعضاء والملفات |
| member | قراءة وكتابة الملفات |
| viewer | قراءة فقط |

---

## 🔄 Collaboration API (التعاون الفوري)

### WebSocket Events

```javascript
// الاتصال
ws.send(JSON.stringify({ type: 'auth', token: 'access-token' }));

// الانضمام لملف
ws.send(JSON.stringify({ type: 'join_file', fileId: 'file-uuid' }));

// تحديث المؤشر
ws.send(JSON.stringify({ 
  type: 'cursor_update', 
  position: { line: 10, column: 5 },
  selection: { start: 100, end: 150 }
}));

// تعليق حي
ws.send(JSON.stringify({ 
  type: 'live_comment', 
  content: 'تعليق @username',
  position: { line: 10 }
}));

// إشارة (@mention)
ws.send(JSON.stringify({ 
  type: 'mention',
  fileId: 'file-uuid',
  mentionedUserId: 'user-uuid',
  context: 'النص المحيط'
}));
```

### الأحداث المستلمة

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'presence_update':
      // قائمة المشاهدين تغيرت
      break;
    case 'cursor_update':
      // مؤشر مستخدم آخر تحرك
      break;
    case 'live_comment':
      // تعليق جديد
      break;
    case 'mention':
      // تم ذكرك
      break;
  }
};
```

---

## 🔔 Webhooks API

### إنشاء Webhook

```http
POST /api/webhooks
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Slack Integration",
  "url": "https://hooks.slack.com/...",
  "events": ["file.uploaded", "file.shared", "team.member_added"]
}
```

### الأحداث المتاحة

| الحدث | الوصف |
|-------|-------|
| file.uploaded | رفع ملف جديد |
| file.deleted | حذف ملف |
| file.shared | مشاركة ملف |
| file.downloaded | تحميل ملف |
| folder.created | إنشاء مجلد |
| folder.deleted | حذف مجلد |
| user.registered | تسجيل مستخدم جديد |
| user.login | تسجيل دخول |
| share.created | إنشاء مشاركة |
| share.accessed | الوصول لمشاركة |
| comment.added | إضافة تعليق |
| team.created | إنشاء فريق |
| team.member_added | إضافة عضو للفريق |

### Webhook Payload

```json
{
  "id": "delivery-uuid",
  "event": "file.uploaded",
  "timestamp": 1701619200000,
  "data": {
    "fileId": "file-uuid",
    "fileName": "document.pdf",
    "userId": "user-uuid"
  }
}
```

### Headers

```
X-Webhook-ID: webhook-uuid
X-Webhook-Event: file.uploaded
X-Webhook-Signature: sha256=...
X-Webhook-Timestamp: 1701619200000
X-Delivery-ID: delivery-uuid
```

### التحقق من التوقيع

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

---

## 📱 Push Notifications API

### الحصول على VAPID Key

```http
GET /api/notifications/push/vapid-key
Authorization: Bearer {token}
```

### الاشتراك في الإشعارات

```http
POST /api/notifications/push/subscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "deviceInfo": {
    "platform": "web",
    "browser": "Chrome"
  }
}
```

### إلغاء الاشتراك

```http
POST /api/notifications/push/unsubscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/..."
}
```
