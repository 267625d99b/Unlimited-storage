import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  FiLock, FiEye, FiEyeOff, FiHardDrive, FiAlertCircle, 
  FiCloud, FiShield, FiUser, FiMail, FiUserPlus, FiLogIn,
  FiCheck, FiX
} from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

// Password validation function (mirrors server-side)
function validatePassword(password, userInfo = {}) {
  const errors = [];
  let strength = 0;
  
  if (!password) {
    return { valid: false, errors: ['كلمة المرور مطلوبة'], strength: 0 };
  }
  
  // Length check (min 8)
  if (password.length < 8) {
    errors.push('8 أحرف على الأقل');
  } else {
    strength += 20;
  }
  
  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('حرف كبير (A-Z)');
  } else {
    strength += 20;
  }
  
  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('حرف صغير (a-z)');
  } else {
    strength += 20;
  }
  
  // Numbers check
  if (!/[0-9]/.test(password)) {
    errors.push('رقم (0-9)');
  } else {
    strength += 20;
  }
  
  // Special characters check
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('رمز خاص (!@#$%...)');
  } else {
    strength += 20;
  }
  
  // User info check
  if (userInfo.username && password.toLowerCase().includes(userInfo.username.toLowerCase())) {
    errors.push('لا تستخدم اسم المستخدم');
    strength = Math.max(0, strength - 20);
  }
  
  // Bonus for length
  if (password.length >= 12) strength = Math.min(100, strength + 10);
  if (password.length >= 16) strength = Math.min(100, strength + 10);
  
  return {
    valid: errors.length === 0,
    errors,
    strength: Math.min(100, strength)
  };
}

function getStrengthLabel(strength) {
  if (strength < 40) return { label: 'ضعيفة', color: '#ef4444' };
  if (strength < 60) return { label: 'متوسطة', color: '#f59e0b' };
  if (strength < 80) return { label: 'جيدة', color: '#10b981' };
  return { label: 'قوية', color: '#22c55e' };
}

function PasswordStrengthIndicator({ password, username }) {
  const validation = useMemo(() => 
    validatePassword(password, { username }), 
    [password, username]
  );
  
  const strengthInfo = getStrengthLabel(validation.strength);
  
  const requirements = [
    { label: '8 أحرف على الأقل', met: password.length >= 8 },
    { label: 'حرف كبير (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'حرف صغير (a-z)', met: /[a-z]/.test(password) },
    { label: 'رقم (0-9)', met: /[0-9]/.test(password) },
    { label: 'رمز خاص (!@#$%...)', met: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) },
  ];
  
  if (!password) return null;
  
  return (
    <div className="password-strength">
      <div className="strength-bar-container">
        <div 
          className="strength-bar" 
          style={{ 
            width: `${validation.strength}%`,
            backgroundColor: strengthInfo.color
          }}
        />
      </div>
      <div className="strength-label" style={{ color: strengthInfo.color }}>
        قوة كلمة المرور: {strengthInfo.label}
      </div>
      <div className="password-requirements">
        {requirements.map((req, i) => (
          <div key={i} className={`requirement ${req.met ? 'met' : 'unmet'}`}>
            {req.met ? <FiCheck /> : <FiX />}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/users/login`, {
        username: formData.username,
        password: formData.password
      });
      
      if (res.data.success) {
        localStorage.setItem('access_token', res.data.accessToken);
        localStorage.setItem('refresh_token', res.data.refreshToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        onLogin(res.data.user, res.data.accessToken);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }, [formData, onLogin]);

  const handleRegister = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError('جميع الحقول مطلوبة');
      return;
    }
    
    // Validate password on client side
    const passwordValidation = validatePassword(formData.password, { 
      username: formData.username 
    });
    
    if (!passwordValidation.valid) {
      setError('كلمة المرور يجب أن تحتوي على: ' + passwordValidation.errors.join('، '));
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('كلمة المرور غير متطابقة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/users/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName || formData.username
      });
      
      if (res.data.success) {
        localStorage.setItem('access_token', res.data.accessToken);
        localStorage.setItem('refresh_token', res.data.refreshToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        onLogin(res.data.user, res.data.accessToken);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }, [formData, onLogin]);

  return (
    <div className="auth-page">
      <div className="auth-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/icons/logo.svg" alt="Logo" style={{ width: '64px', height: '64px' }} />
          </div>
          <h1>التخزين السحابي</h1>
          <p>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</p>
        </div>

        {/* Mode Toggle */}
        <div className="auth-tabs">
          <button 
            className={mode === 'login' ? 'active' : ''} 
            onClick={() => { setMode('login'); setError(''); }}
          >
            <FiLogIn /> دخول
          </button>
          <button 
            className={mode === 'register' ? 'active' : ''} 
            onClick={() => { setMode('register'); setError(''); }}
          >
            <FiUserPlus /> تسجيل
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="auth-form">
          {error && (
            <div className="auth-error">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div className="auth-input-wrapper">
            <FiUser className="auth-input-icon" />
            <input
              type="text"
              name="username"
              placeholder="اسم المستخدم"
              value={formData.username}
              onChange={handleChange}
              autoFocus
              disabled={loading}
              className="auth-input"
            />
          </div>

          {/* Email (register only) */}
          {mode === 'register' && (
            <div className="auth-input-wrapper">
              <FiMail className="auth-input-icon" />
              <input
                type="email"
                name="email"
                placeholder="البريد الإلكتروني"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className="auth-input"
              />
            </div>
          )}

          {/* Display Name (register only) */}
          {mode === 'register' && (
            <div className="auth-input-wrapper">
              <FiUser className="auth-input-icon" />
              <input
                type="text"
                name="displayName"
                placeholder="الاسم الظاهر (اختياري)"
                value={formData.displayName}
                onChange={handleChange}
                disabled={loading}
                className="auth-input"
              />
            </div>
          )}

          {/* Password */}
          <div className="auth-input-wrapper">
            <FiLock className="auth-input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="كلمة المرور"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              className="auth-input"
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          {/* Password Strength Indicator (register only) */}
          {mode === 'register' && (
            <PasswordStrengthIndicator 
              password={formData.password} 
              username={formData.username}
            />
          )}

          {/* Confirm Password (register only) */}
          {mode === 'register' && (
            <div className="auth-input-wrapper">
              <FiLock className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="تأكيد كلمة المرور"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                className="auth-input"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <span className="password-mismatch">
                  <FiX /> غير متطابقة
                </span>
              )}
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-spinner"></span>
            ) : mode === 'login' ? (
              'تسجيل الدخول'
            ) : (
              'إنشاء حساب'
            )}
          </button>
        </form>

        <div className="auth-features">
          <div className="auth-feature">
            <FiCloud />
            <span>تخزين غير محدود</span>
          </div>
          <div className="auth-feature">
            <FiShield />
            <span>آمن ومشفر</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
