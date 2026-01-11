# Implementation Plan - React Native Mobile App

- [-] 1. إعداد مشروع React Native مع Expo




  - [x] 1.1 إنشاء مشروع Expo جديد مع TypeScript

    - تشغيل `npx create-expo-app mobile --template expo-template-blank-typescript`
    - إعداد `app.json` مع اسم التطبيق والأيقونات
    - _Requirements: 10.1_

  - [x] 1.2 تثبيت المكتبات الأساسية

    - تثبيت expo-router, zustand, @tanstack/react-query, axios, react-native-mmkv
    - تثبيت expo-image, expo-av, expo-file-system
    - _Requirements: 10.1, 10.5_

  - [ ] 1.3 إعداد هيكل المجلدات
    - إنشاء مجلدات app/, components/, hooks/, services/, stores/, utils/, types/
    - _Requirements: 10.1_

- [ ] 2. إعداد الخدمات الأساسية
  - [ ] 2.1 إنشاء API Client
    - إنشاء `services/api.ts` مع Axios instance
    - إعداد interceptors للـ token والـ refresh
    - إضافة دوال الـ API الأساسية (files, folders, auth)
    - _Requirements: 1.2, 1.4, 2.1_
  - [ ] 2.2 إنشاء Auth Service
    - إنشاء `services/auth.ts` للمصادقة
    - إعداد تخزين آمن للـ token في Keychain
    - _Requirements: 1.2, 1.5_
  - [ ] 2.3 إنشاء Storage Service
    - إنشاء `services/storage.ts` باستخدام MMKV
    - دوال للتخزين المحلي والـ cache
    - _Requirements: 4.5, 10.3_

- [ ] 3. إعداد State Management
  - [ ] 3.1 إنشاء Auth Store
    - إنشاء `stores/authStore.ts` مع Zustand
    - حالات: user, token, isAuthenticated, isLoading
    - actions: login, logout, checkAuth
    - _Requirements: 1.1, 1.2, 1.5_
  - [ ] 3.2 إنشاء Files Store
    - إنشاء `stores/filesStore.ts`
    - حالات: files, currentFolder, breadcrumbs, viewMode
    - actions: fetchFiles, navigateToFolder, refresh
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 3.3 إنشاء Settings Store
    - إنشاء `stores/settingsStore.ts`
    - حالات: theme, viewMode, sortBy, cameraUpload
    - _Requirements: 9.1, 9.4, 9.5_

- [ ] 4. بناء شاشات المصادقة
  - [ ] 4.1 إنشاء شاشة تسجيل الدخول
    - إنشاء `app/(auth)/login.tsx`
    - حقول email وpassword مع validation
    - زر تسجيل الدخول مع loading state
    - _Requirements: 1.1, 1.2_
  - [ ] 4.2 إضافة المصادقة البيومترية
    - تثبيت expo-local-authentication
    - إضافة خيار تسجيل الدخول بالبصمة/الوجه
    - _Requirements: 1.3_
  - [ ] 4.3 إنشاء Root Layout مع Auth Check
    - إنشاء `app/_layout.tsx`
    - التحقق من حالة المصادقة عند بدء التطبيق
    - _Requirements: 1.4, 1.5_

- [ ] 5. بناء شاشة الملفات الرئيسية
  - [ ] 5.1 إنشاء Tab Layout
    - إنشاء `app/(tabs)/_layout.tsx`
    - تعريف التبويبات: Files, Search, Shared, Settings
    - _Requirements: 2.1_
  - [ ] 5.2 إنشاء مكون FileItem
    - إنشاء `components/files/FileItem.tsx`
    - عرض اسم الملف، الحجم، النوع، التاريخ
    - دعم عرض List و Grid
    - _Requirements: 2.4_
  - [ ] 5.3 إنشاء شاشة Files Tab
    - إنشاء `app/(tabs)/index.tsx`
    - عرض قائمة الملفات مع FlatList
    - دعم Pull-to-refresh
    - _Requirements: 2.1, 2.3_
  - [ ] 5.4 إنشاء شاشة Folder View
    - إنشاء `app/folder/[id].tsx`
    - التنقل داخل المجلدات
    - عرض Breadcrumbs
    - _Requirements: 2.2_

- [ ] 6. بناء نظام البحث
  - [ ] 6.1 إنشاء مكون SearchBar
    - إنشاء `components/common/SearchBar.tsx`
    - بحث في الوقت الفعلي مع debounce
    - _Requirements: 2.5_
  - [ ] 6.2 إنشاء شاشة Search Tab
    - إنشاء `app/(tabs)/search.tsx`
    - عرض نتائج البحث
    - فلترة حسب النوع
    - _Requirements: 2.5_

- [ ] 7. بناء نظام رفع الملفات
  - [ ] 7.1 إنشاء Upload Service
    - إنشاء `services/upload.ts`
    - دعم رفع الملفات العادية
    - دعم Chunked Upload للملفات الكبيرة
    - _Requirements: 3.2, 3.3_
  - [ ] 7.2 إنشاء مكون UploadButton
    - إنشاء `components/upload/UploadButton.tsx`
    - خيارات: Gallery, Camera, Files
    - _Requirements: 3.1_
  - [ ] 7.3 إنشاء مكون UploadProgress
    - إنشاء `components/upload/UploadProgress.tsx`
    - عرض التقدم والسرعة
    - أزرار Pause/Resume/Cancel
    - _Requirements: 3.2_
  - [ ] 7.4 إضافة Background Upload
    - تثبيت expo-background-fetch
    - استمرار الرفع في الخلفية
    - _Requirements: 3.5_
  - [ ] 7.5 إضافة Resume Upload
    - حفظ حالة الرفع عند الانقطاع
    - استئناف تلقائي عند عودة الاتصال
    - _Requirements: 3.4_

- [ ] 8. بناء نظام تحميل الملفات
  - [ ] 8.1 إنشاء Download Service
    - إنشاء `services/download.ts`
    - تحميل الملفات مع progress
    - حفظ في مجلد التطبيق
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 8.2 إضافة Resume Download
    - دعم استئناف التحميل المتوقف
    - _Requirements: 4.4_
  - [ ] 8.3 إضافة Offline Files
    - تحديد ملفات للتوفر offline
    - مزامنة تلقائية
    - _Requirements: 4.5_

- [ ] 9. بناء معاينة الملفات
  - [ ] 9.1 إنشاء شاشة File Preview
    - إنشاء `app/file/[id].tsx`
    - تحديد نوع الملف وعرض المعاينة المناسبة
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 9.2 إنشاء Image Viewer
    - إنشاء `components/files/ImageViewer.tsx`
    - دعم Zoom و Pan
    - _Requirements: 5.1_
  - [ ] 9.3 إنشاء Video Player
    - إنشاء `components/files/VideoPlayer.tsx`
    - استخدام expo-av
    - _Requirements: 5.2_
  - [ ] 9.4 إنشاء PDF Viewer
    - تثبيت react-native-pdf
    - إنشاء `components/files/PDFViewer.tsx`
    - _Requirements: 5.3_

- [ ] 10. بناء نظام المشاركة
  - [ ] 10.1 إنشاء Share Modal
    - إنشاء `components/files/ShareModal.tsx`
    - خيارات: رابط، كلمة مرور، انتهاء الصلاحية
    - _Requirements: 6.1, 6.2_
  - [ ] 10.2 التكامل مع Native Share
    - استخدام Share API للمشاركة الخارجية
    - _Requirements: 6.3_
  - [ ] 10.3 إنشاء شاشة Shared Tab
    - إنشاء `app/(tabs)/shared.tsx`
    - عرض الملفات المشاركة معي
    - _Requirements: 6.4_

- [ ] 11. بناء نظام المزامنة التلقائية
  - [ ] 11.1 إنشاء Sync Service
    - إنشاء `services/sync.ts`
    - مراقبة Camera Roll للصور الجديدة
    - _Requirements: 7.1, 7.3_
  - [ ] 11.2 إضافة Camera Upload Settings
    - خيارات: WiFi فقط، Mobile Data
    - _Requirements: 7.2_
  - [ ] 11.3 إضافة Duplicate Detection
    - فحص hash قبل الرفع
    - _Requirements: 7.4_
  - [ ] 11.4 عرض Sync Status
    - أيقونات حالة المزامنة على الملفات
    - _Requirements: 7.5_

- [ ] 12. بناء نظام الإشعارات
  - [ ] 12.1 إعداد Push Notifications
    - تثبيت expo-notifications
    - تسجيل الجهاز للإشعارات
    - _Requirements: 8.1_
  - [ ] 12.2 إضافة In-App Notifications
    - عرض إشعارات داخل التطبيق
    - _Requirements: 8.4_
  - [ ] 12.3 معالجة Notification Tap
    - التنقل للملف/المجلد عند الضغط
    - _Requirements: 8.5_

- [ ] 13. بناء شاشة الإعدادات
  - [ ] 13.1 إنشاء شاشة Settings Tab
    - إنشاء `app/(tabs)/settings.tsx`
    - أقسام: Account, Appearance, Sync, About
    - _Requirements: 9.1_
  - [ ] 13.2 إضافة Theme Switcher
    - Light/Dark/System
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ] 13.3 إضافة View Preferences
    - List/Grid view
    - Sort options
    - _Requirements: 9.4, 9.5_

- [ ] 14. تحسين الأداء
  - [ ] 14.1 إضافة Thumbnail Caching
    - تخزين الصور المصغرة محلياً
    - _Requirements: 10.3_
  - [ ] 14.2 تحسين FlatList Performance
    - استخدام getItemLayout, windowSize
    - Lazy loading للصور
    - _Requirements: 10.2_
  - [ ] 14.3 إضافة Memory Management
    - تنظيف الـ cache عند انخفاض الذاكرة
    - _Requirements: 10.4_

- [ ] 15. إعداد البناء والنشر
  - [ ] 15.1 إعداد App Icons و Splash Screen
    - إنشاء أيقونات بجميع الأحجام
    - إعداد Splash Screen
    - _Requirements: 10.1_
  - [ ] 15.2 إعداد EAS Build
    - إعداد eas.json للبناء
    - إنشاء builds للـ iOS و Android
    - _Requirements: 10.1_
  - [ ] 15.3 إنشاء ملف توثيق التطبيق
    - إنشاء MOBILE.md مع تعليمات التشغيل والبناء
    - _Requirements: 10.1_
