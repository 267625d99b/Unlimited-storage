/**
 * Toast Component Tests
 * اختبارات مكون Toast
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toast from '../../components/Toast';

describe('Toast Component', () => {
  it('should render success toast', () => {
    render(<Toast message="تم بنجاح" type="success" onClose={() => {}} />);
    
    expect(screen.getByText('تم بنجاح')).toBeInTheDocument();
  });

  it('should render error toast', () => {
    render(<Toast message="حدث خطأ" type="error" onClose={() => {}} />);
    
    expect(screen.getByText('حدث خطأ')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" type="success" onClose={onClose} />);
    
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should auto-close after timeout', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    render(<Toast message="Test" type="success" onClose={onClose} />);
    
    // Fast forward 3 seconds (default timeout)
    await vi.advanceTimersByTimeAsync(3000);
    
    expect(onClose).toHaveBeenCalled();
    
    vi.useRealTimers();
  });
});
