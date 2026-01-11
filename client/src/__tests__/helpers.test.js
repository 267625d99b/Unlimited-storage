/**
 * Helpers Utility Tests
 * اختبارات دوال المساعدة
 */

import { describe, it, expect } from 'vitest';
import { formatSize, formatDate } from '../utils/helpers';

describe('formatSize', () => {
  it('should format bytes correctly', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatSize(1024)).toBe('1 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatSize(1048576)).toBe('1 MB');
    expect(formatSize(5242880)).toBe('5 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatSize(1073741824)).toBe('1 GB');
    expect(formatSize(2147483648)).toBe('2 GB');
  });

  it('should handle undefined/null', () => {
    expect(formatSize(undefined)).toBe('0 B');
    expect(formatSize(null)).toBe('0 B');
  });
});

describe('formatDate', () => {
  it('should format date string correctly', () => {
    const date = '2024-01-15T10:30:00.000Z';
    const formatted = formatDate(date);
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('should handle invalid date', () => {
    const result = formatDate('invalid-date');
    expect(result).toBeTruthy(); // Should not throw
  });

  it('should handle undefined', () => {
    const result = formatDate(undefined);
    expect(result).toBeTruthy();
  });
});
