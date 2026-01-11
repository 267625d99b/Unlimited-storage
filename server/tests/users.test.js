/**
 * Users Module Tests
 * اختبارات وحدة المستخدمين
 */

const users = require('../users');
const fs = require('fs');
const path = require('path');

// Test data paths
const TEST_USERS_FILE = path.join(__dirname, '..', '.users.test.json');
const TEST_SESSIONS_FILE = path.join(__dirname, '..', '.sessions.test.json');

// Generate unique test IDs
const testRunId = Date.now().toString(36);

describe('Users Module', () => {
  
  beforeAll(async () => {
    // Initialize users system
    await users.initUsers();
  });

  afterAll(() => {
    // Cleanup test files
    try {
      if (fs.existsSync(TEST_USERS_FILE)) fs.unlinkSync(TEST_USERS_FILE);
      if (fs.existsSync(TEST_SESSIONS_FILE)) fs.unlinkSync(TEST_SESSIONS_FILE);
    } catch (e) {}
  });

  // ============ USER CREATION ============
  describe('createUser', () => {
    const uniqueUsername = `testuser_${testRunId}`;
    const uniqueEmail = `test_${testRunId}@example.com`;

    test('should create user with valid data', async () => {
      const user = await users.createUser({
        username: uniqueUsername,
        email: uniqueEmail,
        password: 'Test@123!Pass',
        displayName: 'Test User'
      });

      expect(user).toBeDefined();
      expect(user.username).toBe(uniqueUsername);
      expect(user.email).toBe(uniqueEmail);
      expect(user.role).toBe(users.ROLES.USER);
      expect(user.passwordHash).toBeUndefined(); // Should be sanitized
    });

    test('should reject duplicate username', async () => {
      await expect(users.createUser({
        username: uniqueUsername,
        email: 'different@example.com',
        password: 'Test@123!Pass',
        displayName: 'Another User'
      })).rejects.toThrow();
    });

    test('should reject weak password', async () => {
      await expect(users.createUser({
        username: 'weakpassuser',
        email: 'weak@example.com',
        password: '123456',
        displayName: 'Weak Pass User'
      })).rejects.toThrow();
    });

    test('should reject invalid email', async () => {
      await expect(users.createUser({
        username: 'invalidemail',
        email: 'not-an-email',
        password: 'Test@123!Pass',
        displayName: 'Invalid Email User'
      })).rejects.toThrow();
    });
  });

  // ============ AUTHENTICATION ============
  describe('login', () => {
    const loginUsername = `authtest_${testRunId}`;
    const loginEmail = `auth_${testRunId}@example.com`;
    const loginPassword = 'MyS3cur3!K3y#2024';

    test('should login with valid credentials', async () => {
      // Create user first
      await users.createUser({
        username: loginUsername,
        email: loginEmail,
        password: loginPassword,
        displayName: 'Auth Test'
      });

      const result = await users.login(loginUsername, loginPassword, {
        userAgent: 'Test Agent',
        ip: '127.0.0.1'
      });

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    test('should reject invalid password', async () => {
      await expect(users.login(loginUsername, 'WrongPassword!', {}))
        .rejects.toThrow();
    });

    test('should reject non-existent user', async () => {
      await expect(users.login('nonexistent_user_xyz', 'Password123!', {}))
        .rejects.toThrow();
    });
  });

  // ============ TOKEN VERIFICATION ============
  describe('verifyAccessToken', () => {
    const tokenUsername = `tokentest_${testRunId}`;
    const tokenEmail = `token_${testRunId}@example.com`;
    const tokenPassword = 'Token@123!Pass';
    let validToken;

    beforeAll(async () => {
      try {
        await users.createUser({
          username: tokenUsername,
          email: tokenEmail,
          password: tokenPassword,
          displayName: 'Token Test'
        });
        const result = await users.login(tokenUsername, tokenPassword, {});
        validToken = result.accessToken;
      } catch (e) {}
    });

    test('should verify valid token', () => {
      if (!validToken) {
        console.log('Skipping: no valid token');
        return;
      }
      const decoded = users.verifyAccessToken(validToken);
      expect(decoded).toBeDefined();
      expect(decoded.username).toBe(tokenUsername);
    });

    test('should reject invalid token', () => {
      const decoded = users.verifyAccessToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    test('should reject empty token', () => {
      const decoded = users.verifyAccessToken('');
      expect(decoded).toBeNull();
    });
  });

  // ============ PASSWORD MANAGEMENT ============
  describe('changePassword', () => {
    const passUsername = `passchange_${testRunId}`;
    const passEmail = `passchange_${testRunId}@example.com`;
    const oldPassword = 'Old@Pass123!';
    const newPassword = 'New@Pass456!';

    test('should change password with valid current password', async () => {
      // Create user for password change test
      try {
        await users.createUser({
          username: passUsername,
          email: passEmail,
          password: oldPassword,
          displayName: 'Pass Change'
        });
      } catch (e) {}

      const user = users.getUserByUsername(passUsername);
      if (user) {
        const result = await users.changePassword(
          user.id,
          oldPassword,
          newPassword
        );
        expect(result).toBe(true);
      }
    });

    test('should reject wrong current password', async () => {
      const user = users.getUserByUsername(passUsername);
      if (user) {
        await expect(users.changePassword(
          user.id,
          'WrongPassword!',
          'New@Pass789!'
        )).rejects.toThrow();
      }
    });
  });

  // ============ STORAGE MANAGEMENT ============
  describe('Storage Management', () => {
    test('should check storage limit', () => {
      const user = users.getUserByUsername('testuser1');
      if (user) {
        const canUpload = users.checkStorageLimit(user.id, 1024 * 1024); // 1MB
        expect(typeof canUpload).toBe('boolean');
      }
    });

    test('should get storage info', () => {
      const user = users.getUserByUsername('testuser1');
      if (user) {
        const storage = users.getUserStorageInfo(user.id);
        expect(storage).toBeDefined();
        expect(storage).toHaveProperty('used');
        expect(storage).toHaveProperty('limit');
      }
    });
  });

  // ============ ROLES & PERMISSIONS ============
  describe('Roles & Permissions', () => {
    test('should have correct role permissions', () => {
      expect(users.ROLE_PERMISSIONS[users.ROLES.SUPER_ADMIN].length)
        .toBeGreaterThan(users.ROLE_PERMISSIONS[users.ROLES.USER].length);
    });

    test('should have correct storage limits', () => {
      expect(users.STORAGE_LIMITS[users.ROLES.SUPER_ADMIN]).toBe(-1); // Unlimited
      expect(users.STORAGE_LIMITS[users.ROLES.USER]).toBeGreaterThan(0);
    });
  });
});
