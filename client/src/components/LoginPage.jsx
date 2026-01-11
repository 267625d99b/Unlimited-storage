import { useState, useCallback } from 'react';
import { FiLock, FiEye, FiEyeOff, FiHardDrive, FiAlertCircle, FiCloud, FiShield } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/auth/login`, { password });
      
      if (res.data.success && res.data.token) {
        localStorage.setItem('auth_token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        onLogin(res.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }, [password, onLogin]);

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-container">
        {/* Logo & Title */}
        <div className="login-header">
          <div className="login-logo">
            <FiHardDrive />
          </div>
          <h1>التخزين السحابي</h1>
          <p>تخزين آمن وغير محدود</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}

          <div className="login-input-wrapper">
            <FiLock className="login-input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
              className="login-input"
            />
            <button
              type="button"
              className="login-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner"></span>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        {/* Features */}
        <div className="login-features">
          <div className="login-feature">
            <FiCloud />
            <span>تخزين غير محدود</span>
          </div>
          <div className="login-feature">
            <FiShield />
            <span>آمن ومشفر</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
