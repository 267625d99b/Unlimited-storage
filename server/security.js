/**
 * Security Module
 * وحدة الأمان المتقدمة
 */

const crypto = require('crypto');

// ============ JWT SECRET VALIDATION ============
const WEAK_SECRETS = [
  'default_secret_change_in_production',
  'secret',
  'jwt_secret',
  'your_secret',
  'change_me',
  'password',
  '123456',
  'admin123'
];

/**
 * Validate JWT Secret strength
 * @param {string} secret 
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateJWTSecret(secret) {
  const errors = [];
  
  if (!secret) {
    errors.push('JWT_SECRET غير محدد');
    return { valid: false, errors };
  }
  
  // Check minimum length (32 characters recommended)
  if (secret.length < 32) {
    errors.push('JWT_SECRET يجب أن يكون 32 حرف على الأقل');
  }
  
  // Check for weak/default secrets
  if (WEAK_SECRETS.some(weak => secret.toLowerCase().includes(weak))) {
    errors.push('JWT_SECRET يحتوي على قيمة افتراضية ضعيفة - يجب تغييره');
  }
  
  // Check entropy (randomness)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    errors.push('JWT_SECRET يجب أن يحتوي على تنوع أكبر في الأحرف');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a secure random secret
 * @param {number} length 
 * @returns {string}
 */
function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url');
}

// ============ PASSWORD POLICY ============
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  preventCommonPasswords: true,
  preventUserInfo: true // Prevent password containing username/email
};

// Common weak passwords list
const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'master', 'dragon', 'letmein', 'login', 'admin', 'admin123',
  'welcome', 'password1', 'p@ssw0rd', 'passw0rd', '1234567890',
  'iloveyou', 'princess', 'sunshine', 'football', 'baseball', 'soccer',
  'trustno1', 'superman', 'batman', 'starwars', 'whatever', 'shadow'
];

/**
 * Validate password against policy
 * @param {string} password 
 * @param {object} userInfo - { username, email } for preventing user info in password
 * @returns {{ valid: boolean, errors: string[], strength: number }}
 */
function validatePassword(password, userInfo = {}) {
  const errors = [];
  let strength = 0;
  
  if (!password) {
    return { valid: false, errors: ['كلمة المرور مطلوبة'], strength: 0 };
  }
  
  // Length check
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`كلمة المرور يجب أن تكون ${PASSWORD_POLICY.minLength} أحرف على الأقل`);
  } else {
    strength += 20;
  }
  
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`كلمة المرور يجب أن تكون أقل من ${PASSWORD_POLICY.maxLength} حرف`);
  }
  
  // Uppercase check
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
  } else if (/[A-Z]/.test(password)) {
    strength += 20;
  }
  
  // Lowercase check
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
  } else if (/[a-z]/.test(password)) {
    strength += 20;
  }
  
  // Numbers check
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9)');
  } else if (/[0-9]/.test(password)) {
    strength += 20;
  }
  
  // Special characters check
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
  if (PASSWORD_POLICY.requireSpecialChars && !hasSpecialChar) {
    errors.push(`كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (${PASSWORD_POLICY.specialChars})`);
  } else if (hasSpecialChar) {
    strength += 20;
  }
  
  // Common passwords check
  if (PASSWORD_POLICY.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
      errors.push('كلمة المرور شائعة جداً وسهلة التخمين');
      strength = Math.max(0, strength - 40);
    }
  }
  
  // User info check
  if (PASSWORD_POLICY.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
      errors.push('كلمة المرور يجب ألا تحتوي على اسم المستخدم');
      strength = Math.max(0, strength - 20);
    }
    if (userInfo.email) {
      const emailPart = userInfo.email.split('@')[0].toLowerCase();
      if (lowerPassword.includes(emailPart)) {
        errors.push('كلمة المرور يجب ألا تحتوي على جزء من البريد الإلكتروني');
        strength = Math.max(0, strength - 20);
      }
    }
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

/**
 * Get password strength label
 * @param {number} strength 
 * @returns {string}
 */
function getPasswordStrengthLabel(strength) {
  if (strength < 40) return 'ضعيفة';
  if (strength < 60) return 'متوسطة';
  if (strength < 80) return 'جيدة';
  return 'قوية';
}

// ============ INPUT SANITIZATION ============

/**
 * Sanitize string input - remove dangerous characters
 * @param {string} input 
 * @returns {string}
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newline, tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize filename - remove path traversal and dangerous characters
 * @param {string} filename 
 * @returns {string}
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return 'unnamed';
  
  return filename
    // Remove path separators
    .replace(/[/\\]/g, '')
    // Remove path traversal
    .replace(/\.\./g, '')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove dangerous Windows characters
    .replace(/[<>:"|?*]/g, '')
    // Limit length
    .substring(0, 255)
    .trim() || 'unnamed';
}

/**
 * Sanitize HTML - escape dangerous characters
 * @param {string} input 
 * @returns {string}
 */
function escapeHtml(input) {
  if (typeof input !== 'string') return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return input.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}

/**
 * Sanitize SQL-like input (for extra safety with parameterized queries)
 * @param {string} input 
 * @returns {string}
 */
function sanitizeSqlInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove SQL comments
    .replace(/--/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove semicolons (statement terminators)
    .replace(/;/g, '')
    .trim();
}

/**
 * Validate and sanitize email
 * @param {string} email 
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'البريد الإلكتروني مطلوب' };
  }
  
  const sanitized = email.toLowerCase().trim();
  
  // Basic email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitized)) {
    return { valid: false, sanitized, error: 'صيغة البريد الإلكتروني غير صحيحة' };
  }
  
  if (sanitized.length > 254) {
    return { valid: false, sanitized, error: 'البريد الإلكتروني طويل جداً' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Validate username
 * @param {string} username 
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, sanitized: '', error: 'اسم المستخدم مطلوب' };
  }
  
  const sanitized = username.toLowerCase().trim();
  
  if (sanitized.length < 3) {
    return { valid: false, sanitized, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
  }
  
  if (sanitized.length > 30) {
    return { valid: false, sanitized, error: 'اسم المستخدم يجب أن يكون أقل من 30 حرف' };
  }
  
  // Only allow alphanumeric, underscore, hyphen
  if (!/^[a-z0-9_-]+$/.test(sanitized)) {
    return { valid: false, sanitized, error: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط' };
  }
  
  // Reserved usernames
  const reserved = ['admin', 'administrator', 'root', 'system', 'api', 'www', 'mail', 'support'];
  if (reserved.includes(sanitized)) {
    return { valid: false, sanitized, error: 'اسم المستخدم محجوز' };
  }
  
  return { valid: true, sanitized };
}

// ============ CSRF PROTECTION ============

/**
 * Generate CSRF token
 * @returns {string}
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create CSRF middleware
 * @param {object} options 
 * @returns {Function}
 */
function csrfProtection(options = {}) {
  const {
    cookieName = '_csrf',
    headerName = 'x-csrf-token',
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  } = options;
  
  return (req, res, next) => {
    // Skip for ignored methods
    if (ignoreMethods.includes(req.method)) {
      return next();
    }
    
    // Get token from cookie
    const cookieToken = req.cookies?.[cookieName];
    
    // Get token from header or body
    const requestToken = req.headers[headerName] || req.body?._csrf;
    
    // Validate
    if (!cookieToken || !requestToken || cookieToken !== requestToken) {
      return res.status(403).json({ error: 'CSRF token invalid', code: 'CSRF_ERROR' });
    }
    
    next();
  };
}

/**
 * CSRF token generator middleware
 * @param {object} options 
 * @returns {Function}
 */
function csrfTokenGenerator(options = {}) {
  const {
    cookieName = '_csrf',
    cookieOptions = {
      httpOnly: false, // Must be readable by JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    }
  } = options;
  
  return (req, res, next) => {
    // Generate new token if not exists
    if (!req.cookies?.[cookieName]) {
      const token = generateCSRFToken();
      res.cookie(cookieName, token, cookieOptions);
      req.csrfToken = token;
    } else {
      req.csrfToken = req.cookies[cookieName];
    }
    
    // Add helper to get token
    res.locals.csrfToken = req.csrfToken;
    
    next();
  };
}

// ============ SECURITY HEADERS ============

/**
 * Additional security headers middleware
 * @returns {Function}
 */
function securityHeaders() {
  return (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  };
}

// ============ EXPORTS ============
module.exports = {
  // JWT
  validateJWTSecret,
  generateSecureSecret,
  
  // Password
  validatePassword,
  getPasswordStrengthLabel,
  PASSWORD_POLICY,
  
  // Sanitization
  sanitizeString,
  sanitizeFilename,
  escapeHtml,
  sanitizeSqlInput,
  validateEmail,
  validateUsername,
  
  // CSRF
  generateCSRFToken,
  csrfProtection,
  csrfTokenGenerator,
  
  // Headers
  securityHeaders
};
