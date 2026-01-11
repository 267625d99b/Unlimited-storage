/**
 * Vitest Configuration for Frontend Tests
 * إعدادات Vitest للاختبارات الأمامية
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/__tests__/setup.js'],
    
    // Include patterns
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    
    // Exclude patterns
    exclude: ['node_modules', 'dist'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.js'
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    },
    
    // Global test APIs
    globals: true,
    
    // CSS handling
    css: true,
    
    // Reporter
    reporters: ['verbose'],
    
    // Timeout
    testTimeout: 10000
  }
});
