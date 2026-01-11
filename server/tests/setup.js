/**
 * Jest Test Setup
 * إعداد بيئة الاختبار
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only_32chars';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing';
process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token';
process.env.TELEGRAM_CHANNEL_ID = '-100123456789';

// Mock console for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});
