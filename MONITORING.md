# Monitoring Guide - دليل المراقبة

## 📊 Prometheus & Grafana

### تشغيل مجموعة المراقبة

```bash
# تشغيل Prometheus و Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# عرض السجلات
docker-compose -f docker-compose.monitoring.yml logs -f

# إيقاف
docker-compose -f docker-compose.monitoring.yml down
```

### الوصول للخدمات

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin / admin123 |
| AlertManager | http://localhost:9093 | - |

---

## 📈 Available Metrics

### HTTP Metrics
- `http_requests_total` - إجمالي الطلبات
- `http_request_duration_seconds` - مدة الطلبات
- `active_connections` - الاتصالات النشطة

### File Operations
- `file_uploads_total` - إجمالي الرفع
- `file_downloads_total` - إجمالي التحميل
- `file_upload_size_bytes` - حجم الملفات المرفوعة

### Storage
- `storage_used_bytes` - التخزين المستخدم
- `total_files` - عدد الملفات
- `total_folders` - عدد المجلدات

### Users
- `total_users` - عدد المستخدمين
- `active_users` - المستخدمين النشطين
- `login_attempts_total` - محاولات تسجيل الدخول

### Database
- `db_query_duration_seconds` - مدة استعلامات قاعدة البيانات
- `cache_hits_total` - إصابات الكاش
- `cache_misses_total` - أخطاء الكاش

### Telegram API
- `telegram_api_calls_total` - استدعاءات Telegram API
- `telegram_api_duration_seconds` - مدة استدعاءات API

### Errors
- `errors_total` - إجمالي الأخطاء

---

## 🚨 Alert Rules

### Critical Alerts
- **ServiceDown** - الخدمة متوقفة
- **BruteForceAttempt** - محاولة اختراق
- **LowDiskSpace** - مساحة القرص منخفضة

### Warning Alerts
- **HighErrorRate** - معدل أخطاء عالي
- **HighResponseTime** - وقت استجابة عالي
- **HighMemoryUsage** - استخدام ذاكرة عالي
- **TooManyConnections** - اتصالات كثيرة

---

## 📱 Metrics Endpoint

```bash
# الحصول على المقاييس
curl http://localhost:3000/metrics
```

---

## 🎯 Grafana Dashboards

### Cloud Storage Dashboard
- Request Rate
- Error Rate
- Response Time Percentiles
- Total Files/Users/Storage
- Active Connections

### إضافة Dashboard جديد
1. افتح Grafana
2. اذهب إلى Dashboards > Import
3. استورد ملف JSON من `monitoring/grafana/dashboards/`
