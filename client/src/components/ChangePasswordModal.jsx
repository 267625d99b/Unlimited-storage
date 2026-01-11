import { useState, useCallback, memo, useMemo } from 'react';
import { FiLock, FiEye, FiEyeOff, FiKey, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';

const API = '/api';

// Password validation function (mirrors server-side)
function validatePassword(password) {
  const errors = [];
  let strength = 0;
  
  if (!password) {
    return { valid: false, errors: ['كلمة المرور مطلوبة'], strength: 0 };
  }
  
  if (password.length < 8) {
    errors.push('8 أحرف على الأقل');
  } else {
    strength += 20;
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('حرف كبير (A-Z)');
  } else {
    strength += 20;
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('حرف صغير (a-z)');
  } else {
    strength += 20;
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('رقم (0-9)');
  } else {
    strength += 20;
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('رمز خاص (!@#$%...)');
  } else {
    strength += 20;
  }
  
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

function PasswordStrengthIndicator({ password }) {
  const validation = useMemo(() => validatePassword(password), [password]);
  const strengthInfo = getStrengthLabel(validation.strength);
  
  const requirements = [
    { label: '8 أحرف', met: password.length >= 8 },
    { label: 'A-Z', met: /[A-Z]/.test(password) },
    { label: 'a-z', met: /[a-z]/.test(password) },
    { label: '0-9', met: /[0-9]/.test(password) },
    { label: '!@#$', met: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) },
  ];
  
  if (!password) return null;
  
  return (
    <div className="password-strength" style={{ marginTop: '8px' }}>
      <div className="strength-bar-container">
        <div 
          className="strength-bar" 
          style={{ 
            width: `${validation.strength}%`,
            backgroundColor: strengthInfo.color
          }}
        />
      </div>
      <div className="strength-label" style={{ color: strengthInfo.color, fontSize: '11px' }}>
        {strengthInfo.label}
      </div>
      <div className="password-requirements" style={{ marginTop: '6px' }}>
        {requirements.map((req, i) => (
          <span 
            key={i} 
            className={`requirement ${req.met ? 'met' : 'unmet'}`}
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            {req.met ? <FiCheck size={10} /> : <FiX size={10} />}
            {req.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const ChangePasswordModal = memo(function ChangePasswordModal({ onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordValidation = useMemo(() => validatePassword(newPassword), [newPassword]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('جميع الحقول مطلوبة');
      return;
    }

    // Validate password strength
    if (!passwordValidation.valid) {
      setError('كلمة المرور يجب أن تحتوي على: ' + passwordValidation.errors.join('، '));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/users/change-password`, {
        currentPassword,
        newPassword
      });
      
      onSuccess('تم تغيير كلمة المرور بنجاح');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, passwordValidation, onClose, onSuccess]);

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal change-password-modal" onClick={stopPropagation}>
        <h3><FiKey /> تغيير كلمة المرور</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}

          <div className="password-input-group">
            <FiLock className="input-icon" />
            <input
              type={showPasswords ? 'text' : 'password'}
              placeholder="كلمة المرور الحالية"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="password-input-group">
            <FiLock className="input-icon" />
            <input
              type={showPasswords ? 'text' : 'password'}
              placeholder="كلمة المرور الجديدة"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <PasswordStrengthIndicator password={newPassword} />

          <div className="password-input-group">
            <FiLock className="input-icon" />
            <input
              type={showPasswords ? 'text' : 'password'}
              placeholder="تأكيد كلمة المرور الجديدة"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <span style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                <FiX size={12} style={{ verticalAlign: 'middle' }} /> غير متطابقة
              </span>
            )}
          </div>

          <label className="show-password-label">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            <span>إظهار كلمات المرور</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="cancel" onClick={onClose} disabled={loading}>
              إلغاء
            </button>
            <button type="submit" className="confirm" disabled={loading || !passwordValidation.valid}>
              {loading ? 'جاري التغيير...' : 'تغيير'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default ChangePasswordModal;
