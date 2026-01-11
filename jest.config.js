/**
 * Jest Configuration for Backend Tests
 * إعدادات Jest للاختبارات الخلفية
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/server/tests/**/*.test.js',
    '**/server/**/*.spec.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/logs/**',
    '!server/backups/**',
    '!server/cache/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Module paths
  moduleDirectories: ['node_modules', 'server'],
  
  // Timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true
};
