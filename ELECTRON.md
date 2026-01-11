# تشغيل التطبيق كـ Desktop App (Electron)

## المتطلبات
- Node.js 18+
- npm أو yarn

## التثبيت

```bash
# تثبيت جميع الـ dependencies
npm install
npm run install-all
```

## التطوير

```bash
# تشغيل في وضع التطوير (مع hot reload)
npm run electron:dev
```

## البناء

### Windows
```bash
npm run electron:build:win
```
الملفات الناتجة:
- `dist-electron/التخزين السحابي Setup.exe` (مثبت NSIS)
- `dist-electron/التخزين السحابي.exe` (نسخة portable)

### macOS
```bash
npm run electron:build:mac
```
الملفات الناتجة:
- `dist-electron/التخزين السحابي.dmg`
- `dist-electron/التخزين السحابي.zip`

### Linux
```bash
npm run electron:build:linux
```
الملفات الناتجة:
- `dist-electron/التخزين السحابي.AppImage`
- `dist-electron/التخزين السحابي.deb`

### جميع المنصات
```bash
npm run electron:build
```

## الأيقونات

ضع الأيقونات في مجلد `electron/icons/`:
- `icon.png` - أيقونة التطبيق (256x256 أو أكبر)
- `icon.ico` - لـ Windows
- `icon.icns` - لـ macOS  
- `tray-icon.png` - لـ System Tray (16x16 أو 32x32)

## الميزات

- ✅ يعمل offline (بعد تسجيل الدخول الأول)
- ✅ System Tray للوصول السريع
- ✅ اختصارات لوحة المفاتيح
- ✅ Native file dialogs
- ✅ Auto-updates (يمكن إضافتها)
- ✅ يعمل على Windows, macOS, Linux

## اختصارات لوحة المفاتيح

| الاختصار | الوظيفة |
|----------|---------|
| Ctrl+U | رفع ملف |
| Ctrl+N | مجلد جديد |
| Ctrl+, | الإعدادات |
| Ctrl+Q | خروج |
| F11 | ملء الشاشة |
| F12 | أدوات المطور |

## ملاحظات

- التطبيق يحتاج اتصال بالإنترنت للتواصل مع Telegram
- يمكن تصغير التطبيق إلى System Tray
- البيانات تُخزن في مجلد userData الخاص بالتطبيق
