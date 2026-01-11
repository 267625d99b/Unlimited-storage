# Testing Guide - دليل الاختبارات

## 🧪 Backend Tests (Jest)

### تشغيل الاختبارات

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل الاختبارات مع المراقبة
npm run test:watch

# تشغيل الاختبارات مع تقرير التغطية
npm run test:coverage
```

### هيكل الاختبارات

```
server/tests/
├── setup.js           # إعداد بيئة الاختبار
├── security.test.js   # اختبارات وحدة الأمان
├── users.test.js      # اختبارات إدارة المستخدمين
└── api.test.js        # اختبارات تكامل API
```

### كتابة اختبار جديد

```javascript
const security = require('../security');

describe('Security Module', () => {
  test('should validate password', () => {
    const result = security.validatePassword('Str0ng!Pass');
    expect(result.valid).toBe(true);
  });
});
```

---

## 🎨 Frontend Tests (Vitest)

### تشغيل الاختبارات

```bash
cd client

# تشغيل جميع الاختبارات
npm test

# تشغيل الاختبارات مع المراقبة
npm run test:watch

# تشغيل الاختبارات مع تقرير التغطية
npm run test:coverage
```

### هيكل الاختبارات

```
client/src/__tests__/
├── setup.js                    # إعداد بيئة الاختبار
├── helpers.test.js             # اختبارات دوال المساعدة
├── hooks.test.js               # اختبارات الـ Hooks
└── components/
    └── Toast.test.jsx          # اختبارات المكونات
```

### كتابة اختبار مكون

```jsx
import { render, screen } from '@testing-library/react';
import Toast from '../../components/Toast';

describe('Toast Component', () => {
  it('should render message', () => {
    render(<Toast message="Test" type="success" onClose={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## 📊 Coverage Requirements

| Metric | Minimum |
|--------|---------|
| Lines | 50% |
| Functions | 50% |
| Branches | 50% |
| Statements | 50% |

---

## 🔧 CI/CD Integration

الاختبارات تعمل تلقائياً في GitHub Actions عند كل push أو pull request.

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: npm test
```
