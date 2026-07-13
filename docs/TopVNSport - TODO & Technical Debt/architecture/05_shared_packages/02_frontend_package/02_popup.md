# Frontend Package: Popup Components

## Task ID: FE-02
## Prerequisites: FE-00 (Setup)
## Estimated: 2 hours

---

## Mục Tiêu

Tạo popup/toast notification system với:
- Global popup service
- React provider component
- Multiple popup types (success, error, warning, info, confirm)
- Auto-dismiss và queue management

---

## Implementation

### File: `packages/ui-kit/src/components/Popup/popupService.ts`

```typescript
export type PopupType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface PopupOptions {
  id?: string;
  title?: string;
  message: string;
  type?: PopupType;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type Listener = (popup: PopupOptions) => void;

class PopupService {
  private listeners: Set<Listener> = new Set();
  private idCounter = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private generateId(): string {
    return `popup-${++this.idCounter}-${Date.now()}`;
  }

  show(options: PopupOptions): string {
    const id = options.id || this.generateId();
    const popup = { ...options, id };
    this.listeners.forEach(listener => listener(popup));
    return id;
  }

  success(message: string, title?: string, duration?: number): string {
    return this.show({ 
      message, 
      title, 
      type: 'success', 
      duration: duration ?? 3000 
    });
  }

  error(message: string, title?: string, duration?: number): string {
    return this.show({ 
      message, 
      title, 
      type: 'error', 
      duration: duration ?? 5000 
    });
  }

  warning(message: string, title?: string, duration?: number): string {
    return this.show({ 
      message, 
      title, 
      type: 'warning', 
      duration: duration ?? 4000 
    });
  }

  info(message: string, title?: string, duration?: number): string {
    return this.show({ 
      message, 
      title, 
      type: 'info', 
      duration: duration ?? 3000 
    });
  }

  confirm(
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    title?: string
  ): string {
    return this.show({ 
      message, 
      title: title ?? 'Xác nhận',
      type: 'confirm', 
      onConfirm, 
      onCancel,
      duration: 0, // No auto-dismiss for confirm
    });
  }
}

export const popupService = new PopupService();
```

### File: `packages/ui-kit/src/components/Popup/SystemPopupProvider.tsx`

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { popupService, PopupOptions, PopupType } from './popupService';
import { cn } from '../../utils/cn';

interface PopupState extends PopupOptions {
  id: string;
  isVisible: boolean;
}

const typeConfig: Record<PopupType, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  confirm: {
    icon: AlertTriangle,
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    iconColor: 'text-blue-500',
  },
};

interface SystemPopupProviderProps {
  children: React.ReactNode;
  maxPopups?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

export function SystemPopupProvider({ 
  children, 
  maxPopups = 5,
  position = 'top-right',
}: SystemPopupProviderProps) {
  const [popups, setPopups] = useState<PopupState[]>([]);

  const removePopup = useCallback((id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  const handlePopup = useCallback((options: PopupOptions) => {
    const id = options.id || `popup-${Date.now()}`;
    
    setPopups(prev => {
      // Remove oldest if at max
      const newPopups = prev.length >= maxPopups 
        ? prev.slice(1) 
        : prev;
      
      return [...newPopups, { ...options, id, isVisible: true }];
    });

    // Auto-dismiss (except confirm)
    if (options.type !== 'confirm' && options.duration !== 0) {
      const duration = options.duration ?? 3000;
      setTimeout(() => removePopup(id), duration);
    }
  }, [maxPopups, removePopup]);

  useEffect(() => {
    return popupService.subscribe(handlePopup);
  }, [handlePopup]);

  const handleConfirm = (popup: PopupState) => {
    popup.onConfirm?.();
    removePopup(popup.id);
  };

  const handleCancel = (popup: PopupState) => {
    popup.onCancel?.();
    removePopup(popup.id);
  };

  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
  };

  return (
    <>
      {children}
      
      {/* Popup Container */}
      <div 
        className={cn(
          'fixed z-50 flex flex-col gap-2',
          positionClasses[position],
        )}
        role="region"
        aria-label="Thông báo"
      >
        {popups.map((popup) => {
          const config = typeConfig[popup.type || 'info'];
          const Icon = config.icon;
          
          return (
            <div
              key={popup.id}
              className={cn(
                'w-80 rounded-lg border p-4 shadow-lg transition-all',
                'animate-in slide-in-from-right-5 fade-in duration-200',
                config.bgColor,
                config.borderColor,
              )}
              role={popup.type === 'confirm' ? 'alertdialog' : 'alert'}
              aria-live={popup.type === 'error' ? 'assertive' : 'polite'}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />
                
                <div className="flex-1 min-w-0">
                  {popup.title && (
                    <h4 className="font-medium text-gray-900 mb-1">
                      {popup.title}
                    </h4>
                  )}
                  <p className="text-sm text-gray-700">
                    {popup.message}
                  </p>
                  
                  {popup.type === 'confirm' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleConfirm(popup)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                      >
                        Xác nhận
                      </button>
                      <button
                        onClick={() => handleCancel(popup)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => removePopup(popup.id)}
                  className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Confirm Overlay */}
      {popups.some(p => p.type === 'confirm') && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => {
            const confirmPopup = popups.find(p => p.type === 'confirm');
            if (confirmPopup) handleCancel(confirmPopup);
          }}
        />
      )}
    </>
  );
}
```

---

## Test Cases

### File: `packages/ui-kit/src/components/Popup/__tests__/popupService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { popupService } from '../popupService';

describe('PopupService', () => {
  beforeEach(() => {
    // Reset service state between tests
    vi.clearAllMocks();
  });

  describe('subscribe/unsubscribe', () => {
    it('notifies subscribers when popup shown', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.show({ message: 'Test' });
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test' })
      );
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = popupService.subscribe(listener);
      
      unsubscribe();
      popupService.show({ message: 'Test' });
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple subscribers all notified', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      
      popupService.subscribe(listener1);
      popupService.subscribe(listener2);
      popupService.subscribe(listener3);
      
      popupService.show({ message: 'Test' });
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe('show()', () => {
    it('passes all options to listeners', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.show({
        message: 'Test message',
        title: 'Test title',
        type: 'warning',
        duration: 5000,
      });
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
          title: 'Test title',
          type: 'warning',
          duration: 5000,
        })
      );
    });

    it('generates unique id', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.show({ message: 'Test 1' });
      popupService.show({ message: 'Test 2' });
      
      const id1 = listener.mock.calls[0][0].id;
      const id2 = listener.mock.calls[1][0].id;
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('returns the popup id', () => {
      popupService.subscribe(() => {});
      
      const id = popupService.show({ message: 'Test' });
      
      expect(id).toMatch(/^popup-/);
    });
  });

  describe('success()', () => {
    it('shows success popup with message', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.success('Saved!');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Saved!',
          type: 'success',
        })
      );
    });

    it('includes title if provided', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.success('Saved!', 'Thành công');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Thành công',
        })
      );
    });

    it('uses default duration', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.success('Saved!');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 3000,
        })
      );
    });

    it('accepts custom duration', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.success('Saved!', undefined, 5000);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 5000,
        })
      );
    });
  });

  describe('error()', () => {
    it('shows error popup with message', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.error('Failed!');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed!',
          type: 'error',
        })
      );
    });

    it('uses longer default duration', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.error('Failed!');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 5000, // Longer for errors
        })
      );
    });
  });

  describe('warning()', () => {
    it('shows warning popup', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.warning('Watch out!');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          duration: 4000,
        })
      );
    });
  });

  describe('info()', () => {
    it('shows info popup', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.info('FYI');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          duration: 3000,
        })
      );
    });
  });

  describe('confirm()', () => {
    it('shows confirm popup with callbacks', () => {
      const listener = vi.fn();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      
      popupService.subscribe(listener);
      popupService.confirm('Delete?', onConfirm, onCancel);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Delete?',
          type: 'confirm',
          onConfirm,
          onCancel,
          duration: 0, // No auto-dismiss
        })
      );
    });

    it('uses default title', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.confirm('Delete?', () => {});
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Xác nhận',
        })
      );
    });

    it('accepts custom title', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.confirm('Delete?', () => {}, undefined, 'Xóa sản phẩm');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Xóa sản phẩm',
        })
      );
    });

    it('onCancel is optional', () => {
      const listener = vi.fn();
      popupService.subscribe(listener);
      
      popupService.confirm('Delete?', () => {});
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          onCancel: undefined,
        })
      );
    });
  });
});
```

### File: `packages/ui-kit/src/components/Popup/__tests__/SystemPopupProvider.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemPopupProvider } from '../SystemPopupProvider';
import { popupService } from '../popupService';

describe('SystemPopupProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders children', () => {
      render(
        <SystemPopupProvider>
          <div data-testid="child">Child content</div>
        </SystemPopupProvider>
      );
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('initially shows no popup', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Popup Display', () => {
    it('shows popup when service emits', async () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Done!');
      });
      
      expect(screen.getByText('Done!')).toBeInTheDocument();
    });

    it('shows success popup with success styling', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Saved!');
      });
      
      const popup = screen.getByRole('alert');
      expect(popup).toHaveClass('bg-green-50');
    });

    it('shows error popup with error styling', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.error('Failed!');
      });
      
      const popup = screen.getByRole('alert');
      expect(popup).toHaveClass('bg-red-50');
    });

    it('shows popup with title', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Saved!', 'Success Title');
      });
      
      expect(screen.getByText('Success Title')).toBeInTheDocument();
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });

    it('auto-dismisses after duration', async () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Will disappear');
      });
      
      expect(screen.getByText('Will disappear')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      
      expect(screen.queryByText('Will disappear')).not.toBeInTheDocument();
    });

    it('does not auto-dismiss confirm popups', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Confirm?', () => {});
      });
      
      expect(screen.getByText('Confirm?')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(screen.getByText('Confirm?')).toBeInTheDocument();
    });
  });

  describe('Confirm Popup', () => {
    it('shows confirm and cancel buttons', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Delete?', () => {}, () => {});
      });
      
      expect(screen.getByText('Xác nhận')).toBeInTheDocument();
      expect(screen.getByText('Hủy')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onConfirm = vi.fn();
      
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Delete?', onConfirm);
      });
      
      await user.click(screen.getByText('Xác nhận'));
      
      expect(onConfirm).toHaveBeenCalled();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    });

    it('calls onCancel when cancel clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onCancel = vi.fn();
      
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Delete?', () => {}, onCancel);
      });
      
      await user.click(screen.getByText('Hủy'));
      
      expect(onCancel).toHaveBeenCalled();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    });

    it('closes without callback when X clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Delete?', onConfirm, onCancel);
      });
      
      await user.click(screen.getByLabelText('Đóng thông báo'));
      
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Popups', () => {
    it('shows multiple popups', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('First');
        popupService.info('Second');
        popupService.warning('Third');
      });
      
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('respects maxPopups limit', () => {
      render(
        <SystemPopupProvider maxPopups={2}>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('First');
        popupService.info('Second');
        popupService.warning('Third');
      });
      
      expect(screen.queryByText('First')).not.toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('closes popup when X clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Closeable');
      });
      
      await user.click(screen.getByLabelText('Đóng thông báo'));
      
      expect(screen.queryByText('Closeable')).not.toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('unsubscribes on unmount', () => {
      const { unmount } = render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      unmount();
      
      // Should not throw when popup service emits after unmount
      expect(() => {
        act(() => {
          popupService.success('After unmount');
        });
      }).not.toThrow();
    });
  });

  describe('Position', () => {
    it('applies position classes', () => {
      const { container } = render(
        <SystemPopupProvider position="bottom-left">
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Positioned');
      });
      
      const region = screen.getByRole('region');
      expect(region).toHaveClass('bottom-4', 'left-4');
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on region', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.success('Test');
      });
      
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Thông báo');
    });

    it('error popups use assertive aria-live', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.error('Error!');
      });
      
      const popup = screen.getByRole('alert');
      expect(popup).toHaveAttribute('aria-live', 'assertive');
    });

    it('confirm uses alertdialog role', () => {
      render(
        <SystemPopupProvider>
          <div>App</div>
        </SystemPopupProvider>
      );
      
      act(() => {
        popupService.confirm('Confirm?', () => {});
      });
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });
});
```

---

## Verification

```bash
cd packages/ui-kit

# Run popup tests
pnpm test src/components/Popup

# Run with coverage
pnpm test:coverage

# Expected coverage: 100%
```

---

## Checklist

- [ ] popupService.ts implemented
- [ ] SystemPopupProvider.tsx implemented
- [ ] Subscribe/unsubscribe pattern
- [ ] success(), error(), warning(), info(), confirm() methods
- [ ] Auto-dismiss with configurable duration
- [ ] Confirm dialog with onConfirm/onCancel
- [ ] Multiple popups with maxPopups limit
- [ ] Position configuration
- [ ] Close button
- [ ] All 26 test cases pass
- [ ] 100% code coverage
- [ ] Accessibility (roles, aria-live)
