# 🚀 دليل النشر على Railway

## الخطوات:

### 1. رفع المشروع على GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### 2. إنشاء مشروع على Railway
1. اذهب إلى [railway.app](https://railway.app)
2. سجل دخول بحساب GitHub
3. اضغط "New Project"
4. اختر "Deploy from GitHub repo"
5. اختر المشروع

### 3. إضافة Environment Variables
في Railway Dashboard > Variables، أضف:

```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_REFRESH_SECRET=another_secret_key
ADMIN_PASSWORD=YourSecurePassword123!
NODE_ENV=production
GEMINI_API_KEY=your_gemini_key (اختياري)
```

### 4. انتظر البناء
Railway سيقوم تلقائياً بـ:
- تثبيت المكتبات
- بناء الـ Frontend
- تشغيل السيرفر

### 5. الوصول للتطبيق
بعد النشر، ستحصل على رابط مثل:
`https://your-app.railway.app`

---

## ⚠️ ملاحظات مهمة:

### قاعدة البيانات
- Railway يوفر Persistent Storage
- SQLite سيعمل بشكل طبيعي
- البيانات ستبقى محفوظة

### الحدود المجانية
- $5 credits شهرياً (مجاني)
- كافي لتطبيق صغير/متوسط
- ~500 ساعة تشغيل

### Domain مخصص
يمكنك إضافة domain خاص من:
Settings > Domains > Add Custom Domain

---

## 🔧 استكشاف الأخطاء:

### التطبيق لا يعمل
1. تحقق من Logs في Railway Dashboard
2. تأكد من Environment Variables
3. تأكد من أن البناء نجح

### خطأ في قاعدة البيانات
- تأكد من أن المجلد `/server` قابل للكتابة
- Railway يوفر ذلك تلقائياً

### خطأ في Telegram
- تأكد من صحة `TELEGRAM_BOT_TOKEN`
- تأكد من أن البوت admin في القناة
