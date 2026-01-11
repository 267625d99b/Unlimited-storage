/**
 * Security Module Tests
 * اختبارات وحدة الأمان
 */

const security = require('../security');

describe('Security Module', () => {
  
  // ============ JWT SECRET VALIDATION ============
  describe('validateJWTSecret', () => {
    test('should reject empty secret', () => {
      const result = security.validateJWTSecret('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject short secret', () => {
      const result = security.validateJWTSecret('short');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JWT_SECRET يجب أن يكون 32 حرف على الأقل');
    });

    test('should reject weak/default secrets', () => {
      const result = security.validateJWTSecret('default_secret_change_in_production');
      expect(result.valid).toBe(false);
    });

    test('should accept strong secret', () => {
      const strongSecret = security.generateSecureSecret(64);
      const result = security.validateJWTSecret(strongSecret);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // ============ PASSWORD VALIDATION ============
  describe('validatePassword', () => {
    test('should reject empty password', () => {
      const result = security.validatePassword('');
      expect(result.valid).toBe(false);
    });

    test('should reject short password', () => {
      const result = security.validatePassword('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('8 أحرف'))).toBe(true);
    });

    test('should reject password without uppercase', () => {
      const result = security.validatePassword('abcdefg1!');
      expect(result.valid).toBe(false);
    });

    test('should reject password without lowercase', () => {
      const result = security.validatePassword('ABCDEFG1!');
      expect(result.valid).toBe(false);
    });

    test('should reject password without numbers', () => {
      const result = security.validatePassword('Abcdefgh!');
      expect(result.valid).toBe(false);
    });

    test('should reject password without special chars', () => {
      const result = security.validatePassword('Abcdefg1');
      expect(result.valid).toBe(false);
    });

    test('should reject common passwords', () => {
      const result = security.validatePassword('Password123!');
      expect(result.valid).toBe(false);
    });

    test('should reject password containing username', () => {
      const result = security.validatePassword('Ahmed123!@#', { username: 'ahmed' });
      expect(result.valid).toBe(false);
    });

    test('should accept strong password', () => {
      const result = security.validatePassword('MyS3cur3!K3y#2024');
      expect(result.valid).toBe(true);
      expect(result.strength).toBeGreaterThanOrEqual(80);
    });
  });

  // ============ INPUT SANITIZATION ============
  describe('sanitizeString', () => {
    test('should remove null bytes', () => {
      const result = security.sanitizeString('hello\x00world');
      expect(result).toBe('helloworld');
    });

    test('should trim whitespace', () => {
      const result = security.sanitizeString('  hello  ');
      expect(result).toBe('hello');
    });

    test('should handle non-string input', () => {
      const result = security.sanitizeString(123);
      expect(result).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    test('should remove path traversal', () => {
      const result = security.sanitizeFilename('../../../etc/passwd');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
    });

    test('should remove dangerous characters', () => {
      const result = security.sanitizeFilename('file<>:"|?*.txt');
      expect(result).not.toMatch(/[<>:"|?*]/);
    });

    test('should return unnamed for empty input', () => {
      const result = security.sanitizeFilename('');
      expect(result).toBe('unnamed');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML entities', () => {
      const result = security.escapeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });

  // ============ EMAIL VALIDATION ============
  describe('validateEmail', () => {
    test('should reject empty email', () => {
      const result = security.validateEmail('');
      expect(result.valid).toBe(false);
    });

    test('should reject invalid email format', () => {
      const result = security.validateEmail('invalid-email');
      expect(result.valid).toBe(false);
    });

    test('should accept valid email', () => {
      const result = security.validateEmail('user@example.com');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('user@example.com');
    });

    test('should lowercase email', () => {
      const result = security.validateEmail('User@Example.COM');
      expect(result.sanitized).toBe('user@example.com');
    });
  });

  // ============ USERNAME VALIDATION ============
  describe('validateUsername', () => {
    test('should reject short username', () => {
      const result = security.validateUsername('ab');
      expect(result.valid).toBe(false);
    });

    test('should reject reserved usernames', () => {
      const result = security.validateUsername('admin');
      expect(result.valid).toBe(false);
    });

    test('should reject special characters', () => {
      const result = security.validateUsername('user@name');
      expect(result.valid).toBe(false);
    });

    test('should accept valid username', () => {
      const result = security.validateUsername('john_doe123');
      expect(result.valid).toBe(true);
    });
  });

  // ============ CSRF TOKEN ============
  describe('generateCSRFToken', () => {
    test('should generate unique tokens', () => {
      const token1 = security.generateCSRFToken();
      const token2 = security.generateCSRFToken();
      expect(token1).not.toBe(token2);
    });

    test('should generate 64 character hex string', () => {
      const token = security.generateCSRFToken();
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });
});
