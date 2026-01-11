/**
 * Swagger API Documentation - Route Definitions
 * تعريفات مسارات API
 */

// ============ AUTH ROUTES ============

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: تسجيل الدخول
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: تم تسجيل الدخول بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: بيانات الدخول غير صحيحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: إنشاء حساب جديد
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: تم إنشاء الحساب بنجاح
 *       400:
 *         description: بيانات غير صالحة
 */

/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: تسجيل الخروج
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم تسجيل الخروج بنجاح
 */

/**
 * @swagger
 * /api/users/refresh:
 *   post:
 *     summary: تجديد Access Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: تم تجديد التوكن
 *       401:
 *         description: Refresh token غير صالح
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: الحصول على بيانات المستخدم الحالي
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات المستخدم
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 storage:
 *                   type: object
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 */

// ============ FILES ROUTES ============

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: قائمة الملفات والمجلدات
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folderId
 *         schema:
 *           type: string
 *         description: معرف المجلد (null للجذر)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, created_at, size, type]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *     responses:
 *       200:
 *         description: قائمة الملفات والمجلدات
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *                 folders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Folder'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: رفع ملف
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               folderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: تم رفع الملف بنجاح
 *       400:
 *         description: خطأ في الرفع
 *       413:
 *         description: حجم الملف كبير جداً
 */

/**
 * @swagger
 * /api/download/{id}:
 *   get:
 *     summary: الحصول على رابط تحميل الملف
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: رابط التحميل
 *       404:
 *         description: الملف غير موجود
 */

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: حذف ملف
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف بنجاح
 *       404:
 *         description: الملف غير موجود
 */

// ============ FOLDERS ROUTES ============

/**
 * @swagger
 * /api/folders:
 *   post:
 *     summary: إنشاء مجلد جديد
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: تم إنشاء المجلد
 *       400:
 *         description: اسم غير صالح
 */

/**
 * @swagger
 * /api/folders/{id}:
 *   delete:
 *     summary: حذف مجلد
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف بنجاح
 */

// ============ SEARCH ROUTES ============

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: البحث في الملفات والمجلدات
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: نص البحث
 *     responses:
 *       200:
 *         description: نتائج البحث
 */

/**
 * @swagger
 * /api/search/advanced:
 *   post:
 *     summary: البحث المتقدم
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *               types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [image, video, audio, document, archive]
 *               minSize:
 *                 type: integer
 *               maxSize:
 *                 type: integer
 *               dateFrom:
 *                 type: string
 *                 format: date
 *               dateTo:
 *                 type: string
 *                 format: date
 *               starred:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: نتائج البحث المتقدم
 */

// ============ SHARE ROUTES ============

/**
 * @swagger
 * /api/share/file/{id}:
 *   post:
 *     summary: مشاركة ملف
 *     tags: [Share]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *               expiresIn:
 *                 type: integer
 *                 description: مدة الصلاحية بالثواني
 *               permissions:
 *                 type: string
 *                 enum: [view, download]
 *     responses:
 *       200:
 *         description: تم إنشاء رابط المشاركة
 */

/**
 * @swagger
 * /api/shared/file/{shareId}:
 *   get:
 *     summary: الوصول لملف مشارك
 *     tags: [Share]
 *     parameters:
 *       - in: path
 *         name: shareId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: password
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: بيانات الملف المشارك
 *       401:
 *         description: كلمة المرور مطلوبة
 *       404:
 *         description: الرابط غير صالح
 */

// ============ ADMIN ROUTES ============

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: قائمة المستخدمين (للمدير)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: قائمة المستخدمين
 *       403:
 *         description: غير مصرح
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: إحصائيات النظام
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: إحصائيات النظام
 */

module.exports = {};
