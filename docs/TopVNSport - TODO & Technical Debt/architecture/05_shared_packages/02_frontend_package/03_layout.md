# Frontend Package: Layout Components

## Task ID: FE-03
## Prerequisites: FE-00 (Setup)
## Estimated: 2 hours

---

## Mục Tiêu

Tạo shared layout components:
- Sidebar với menu items
- Topbar với user info
- MobileNav cho responsive

---

## Implementation

### File: `packages/ui-kit/src/components/Layout/Sidebar.tsx`

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MenuItem {
  id: string;
  label: string;
  path?: string;
  icon?: React.ElementType;
  children?: MenuItem[];
  badge?: string | number;
}

export interface SidebarProps {
  menuItems: MenuItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Sidebar({
  menuItems,
  currentPath,
  onNavigate,
  collapsed = false,
  onCollapseToggle,
  logo,
  footer,
  className,
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isActive = (item: MenuItem): boolean => {
    if (item.path === currentPath) return true;
    if (item.children) {
      return item.children.some(child => child.path === currentPath);
    }
    return false;
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const active = isActive(item);

    const handleClick = () => {
      if (hasChildren) {
        toggleExpand(item.id);
      } else if (item.path) {
        onNavigate(item.path);
      }
    };

    return (
      <li key={item.id}>
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            'hover:bg-gray-100',
            active && !hasChildren && 'bg-blue-50 text-blue-700',
            level > 0 && 'pl-10',
          )}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-current={active && !hasChildren ? 'page' : undefined}
        >
          {Icon && (
            <Icon className={cn(
              'h-5 w-5 flex-shrink-0',
              active && !hasChildren ? 'text-blue-700' : 'text-gray-500',
            )} />
          )}
          
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-sm font-medium truncate">
                {item.label}
              </span>
              
              {item.badge && (
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  {item.badge}
                </span>
              )}
              
              {hasChildren && (
                isExpanded 
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </>
          )}
        </button>
        
        {hasChildren && isExpanded && !collapsed && (
          <ul className="mt-1 space-y-1">
            {item.children!.map(child => renderMenuItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
      role="navigation"
      aria-label="Menu chính"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && logo}
        {onCollapseToggle && (
          <button
            onClick={onCollapseToggle}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5 text-gray-500" />
            ) : (
              <PanelLeftClose className="h-5 w-5 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {menuItems.map(item => renderMenuItem(item))}
        </ul>
      </nav>

      {/* Footer */}
      {footer && !collapsed && (
        <div className="p-4 border-t">
          {footer}
        </div>
      )}
    </aside>
  );
}
```

### File: `packages/ui-kit/src/components/Layout/Topbar.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface UserInfo {
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface TopbarProps {
  user: UserInfo;
  onLogout: () => void;
  onMenuToggle?: () => void;
  onSettingsClick?: () => void;
  onProfileClick?: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function Topbar({
  user,
  onLogout,
  onMenuToggle,
  onSettingsClick,
  onProfileClick,
  notificationCount = 0,
  onNotificationClick,
  title,
  actions,
  className,
}: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={cn(
        'flex items-center justify-between h-16 px-4 bg-white border-b',
        className,
      )}
      role="banner"
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        {title && (
          <h1 className="text-lg font-semibold text-gray-900">
            {title}
          </h1>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {actions}
        
        {/* Notifications */}
        <button
          onClick={onNotificationClick}
          className="relative p-2 rounded-lg hover:bg-gray-100"
          aria-label={`Thông báo${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-medium text-blue-700">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-900">
                {user.name}
              </div>
              {user.role && (
                <div className="text-xs text-gray-500">
                  {user.role}
                </div>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border py-1 z-50"
              role="menu"
            >
              <div className="px-4 py-2 border-b sm:hidden">
                <div className="font-medium">{user.name}</div>
                {user.email && (
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                )}
              </div>
              
              {onProfileClick && (
                <button
                  onClick={() => {
                    onProfileClick();
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                >
                  <User className="h-4 w-4" />
                  Hồ sơ
                </button>
              )}
              
              {onSettingsClick && (
                <button
                  onClick={() => {
                    onSettingsClick();
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" />
                  Cài đặt
                </button>
              )}
              
              <button
                onClick={() => {
                  onLogout();
                  setDropdownOpen(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

### File: `packages/ui-kit/src/components/Layout/MobileNav.tsx`

```tsx
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Sidebar, SidebarProps } from './Sidebar';

export interface MobileNavProps extends Omit<SidebarProps, 'collapsed' | 'onCollapseToggle'> {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({
  open,
  onClose,
  onNavigate,
  ...sidebarProps
}: MobileNavProps) {
  const handleNavigate = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu di động"
      >
        <div className="relative h-full">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 z-10"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
          
          <Sidebar
            {...sidebarProps}
            onNavigate={handleNavigate}
            collapsed={false}
          />
        </div>
      </div>
    </>
  );
}
```

---

## Test Cases

### File: `packages/ui-kit/src/components/Layout/__tests__/Sidebar.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home, Package, Users } from 'lucide-react';
import { Sidebar, MenuItem } from '../Sidebar';

const menuItems: MenuItem[] = [
  { id: 'home', label: 'Trang chủ', path: '/', icon: Home },
  { id: 'products', label: 'Sản phẩm', path: '/products', icon: Package, badge: 5 },
  {
    id: 'users',
    label: 'Người dùng',
    icon: Users,
    children: [
      { id: 'users-list', label: 'Danh sách', path: '/users' },
      { id: 'users-roles', label: 'Vai trò', path: '/users/roles' },
    ],
  },
];

describe('Sidebar', () => {
  describe('Rendering', () => {
    it('renders all menu items', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByText('Trang chủ')).toBeInTheDocument();
      expect(screen.getByText('Sản phẩm')).toBeInTheDocument();
      expect(screen.getByText('Người dùng')).toBeInTheDocument();
    });

    it('highlights active item', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/products"
          onNavigate={() => {}}
        />
      );
      
      const activeItem = screen.getByText('Sản phẩm').closest('button');
      expect(activeItem).toHaveClass('bg-blue-50');
    });

    it('renders collapsed state', () => {
      const { container } = render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
          collapsed
        />
      );
      
      expect(container.querySelector('aside')).toHaveClass('w-16');
      // Labels should not be visible
      expect(screen.queryByText('Trang chủ')).not.toBeInTheDocument();
    });

    it('renders badge', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders logo', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
          logo={<div data-testid="logo">Logo</div>}
        />
      );
      
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });

    it('renders footer', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
          footer={<div data-testid="footer">Footer</div>}
        />
      );
      
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('calls onNavigate when item clicked', () => {
      const onNavigate = vi.fn();
      
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={onNavigate}
        />
      );
      
      fireEvent.click(screen.getByText('Sản phẩm'));
      
      expect(onNavigate).toHaveBeenCalledWith('/products');
    });
  });

  describe('Collapse Toggle', () => {
    it('calls onCollapseToggle when toggle clicked', () => {
      const onCollapseToggle = vi.fn();
      
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
          onCollapseToggle={onCollapseToggle}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Thu gọn menu'));
      
      expect(onCollapseToggle).toHaveBeenCalled();
    });

    it('shows expand label when collapsed', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
          collapsed
          onCollapseToggle={() => {}}
        />
      );
      
      expect(screen.getByLabelText('Mở rộng menu')).toBeInTheDocument();
    });
  });

  describe('Nested Menu', () => {
    it('expands submenu on parent click', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      // Children should not be visible initially
      expect(screen.queryByText('Danh sách')).not.toBeInTheDocument();
      
      // Click parent
      fireEvent.click(screen.getByText('Người dùng'));
      
      // Children should now be visible
      expect(screen.getByText('Danh sách')).toBeInTheDocument();
      expect(screen.getByText('Vai trò')).toBeInTheDocument();
    });

    it('collapses submenu on second click', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      // Expand
      fireEvent.click(screen.getByText('Người dùng'));
      expect(screen.getByText('Danh sách')).toBeInTheDocument();
      
      // Collapse
      fireEvent.click(screen.getByText('Người dùng'));
      expect(screen.queryByText('Danh sách')).not.toBeInTheDocument();
    });

    it('navigates when child item clicked', () => {
      const onNavigate = vi.fn();
      
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={onNavigate}
        />
      );
      
      // Expand parent
      fireEvent.click(screen.getByText('Người dùng'));
      
      // Click child
      fireEvent.click(screen.getByText('Vai trò'));
      
      expect(onNavigate).toHaveBeenCalledWith('/users/roles');
    });

    it('highlights parent when child is active', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/users/roles"
          onNavigate={() => {}}
        />
      );
      
      // Parent should have some active indication
      const parentButton = screen.getByText('Người dùng').closest('button');
      expect(parentButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper navigation role', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Menu chính');
    });

    it('active item has aria-current', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      const activeItem = screen.getByText('Trang chủ').closest('button');
      expect(activeItem).toHaveAttribute('aria-current', 'page');
    });

    it('expandable items have aria-expanded', () => {
      render(
        <Sidebar
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      const expandable = screen.getByText('Người dùng').closest('button');
      expect(expandable).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(expandable!);
      expect(expandable).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
```

### File: `packages/ui-kit/src/components/Layout/__tests__/Topbar.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Topbar } from '../Topbar';

const mockUser = {
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'Administrator',
};

describe('Topbar', () => {
  describe('Rendering', () => {
    it('renders user info', () => {
      render(
        <Topbar user={mockUser} onLogout={() => {}} />
      );
      
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    it('renders user initials when no avatar', () => {
      render(
        <Topbar user={mockUser} onLogout={() => {}} />
      );
      
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders avatar when provided', () => {
      render(
        <Topbar 
          user={{ ...mockUser, avatar: '/avatar.png' }} 
          onLogout={() => {}} 
        />
      );
      
      expect(screen.getByAltText('Admin User')).toBeInTheDocument();
    });

    it('renders notification badge', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          notificationCount={5}
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows 9+ for large notification count', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          notificationCount={100}
        />
      );
      
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          title="Dashboard"
        />
      );
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('User Menu', () => {
    it('opens dropdown on avatar click', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onProfileClick={() => {}}
          onSettingsClick={() => {}}
        />
      );
      
      // Dropdown should be closed
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      
      // Click to open
      fireEvent.click(screen.getByText('Admin User'));
      
      // Dropdown should be open
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByText('Đăng xuất')).toBeInTheDocument();
    });

    it('calls onLogout when logout clicked', () => {
      const onLogout = vi.fn();
      
      render(
        <Topbar user={mockUser} onLogout={onLogout} />
      );
      
      fireEvent.click(screen.getByText('Admin User'));
      fireEvent.click(screen.getByText('Đăng xuất'));
      
      expect(onLogout).toHaveBeenCalled();
    });

    it('calls onProfileClick when profile clicked', () => {
      const onProfileClick = vi.fn();
      
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onProfileClick={onProfileClick}
        />
      );
      
      fireEvent.click(screen.getByText('Admin User'));
      fireEvent.click(screen.getByText('Hồ sơ'));
      
      expect(onProfileClick).toHaveBeenCalled();
    });

    it('calls onSettingsClick when settings clicked', () => {
      const onSettingsClick = vi.fn();
      
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onSettingsClick={onSettingsClick}
        />
      );
      
      fireEvent.click(screen.getByText('Admin User'));
      fireEvent.click(screen.getByText('Cài đặt'));
      
      expect(onSettingsClick).toHaveBeenCalled();
    });

    it('closes dropdown after action', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onProfileClick={() => {}}
        />
      );
      
      fireEvent.click(screen.getByText('Admin User'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Hồ sơ'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes dropdown on click outside', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <Topbar user={mockUser} onLogout={() => {}} />
        </div>
      );
      
      fireEvent.click(screen.getByText('Admin User'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Mobile Menu Toggle', () => {
    it('shows hamburger when onMenuToggle provided', () => {
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onMenuToggle={() => {}}
        />
      );
      
      expect(screen.getByLabelText('Mở menu')).toBeInTheDocument();
    });

    it('calls onMenuToggle when clicked', () => {
      const onMenuToggle = vi.fn();
      
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onMenuToggle={onMenuToggle}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Mở menu'));
      
      expect(onMenuToggle).toHaveBeenCalled();
    });
  });

  describe('Notifications', () => {
    it('calls onNotificationClick when clicked', () => {
      const onNotificationClick = vi.fn();
      
      render(
        <Topbar 
          user={mockUser} 
          onLogout={() => {}}
          onNotificationClick={onNotificationClick}
        />
      );
      
      fireEvent.click(screen.getByLabelText(/Thông báo/));
      
      expect(onNotificationClick).toHaveBeenCalled();
    });
  });
});
```

### File: `packages/ui-kit/src/components/Layout/__tests__/MobileNav.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileNav } from '../MobileNav';

const menuItems = [
  { id: 'home', label: 'Trang chủ', path: '/' },
  { id: 'products', label: 'Sản phẩm', path: '/products' },
];

describe('MobileNav', () => {
  describe('Visibility', () => {
    it('visible when open=true', () => {
      render(
        <MobileNav
          open={true}
          onClose={() => {}}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByRole('dialog')).toHaveClass('translate-x-0');
    });

    it('hidden when open=false', () => {
      render(
        <MobileNav
          open={false}
          onClose={() => {}}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByRole('dialog')).toHaveClass('-translate-x-full');
    });
  });

  describe('Overlay', () => {
    it('closes on overlay click', () => {
      const onClose = vi.fn();
      
      const { container } = render(
        <MobileNav
          open={true}
          onClose={onClose}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      // Click overlay (first fixed div with bg-black)
      const overlay = container.querySelector('.bg-black\\/50');
      fireEvent.click(overlay!);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Close Button', () => {
    it('closes when X clicked', () => {
      const onClose = vi.fn();
      
      render(
        <MobileNav
          open={true}
          onClose={onClose}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Đóng menu'));
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('closes after navigation', () => {
      const onClose = vi.fn();
      const onNavigate = vi.fn();
      
      render(
        <MobileNav
          open={true}
          onClose={onClose}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={onNavigate}
        />
      );
      
      fireEvent.click(screen.getByText('Sản phẩm'));
      
      expect(onNavigate).toHaveBeenCalledWith('/products');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(
        <MobileNav
          open={true}
          onClose={() => {}}
          menuItems={menuItems}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });
});
```

---

## Verification

```bash
cd packages/ui-kit

# Run layout tests
pnpm test src/components/Layout

# Run with coverage
pnpm test:coverage

# Expected coverage: 100%
```

---

## Checklist

- [ ] Sidebar.tsx implemented
  - [ ] Menu items with icons
  - [ ] Active state highlighting
  - [ ] Collapsed state
  - [ ] Nested menu items
  - [ ] Badge support
  - [ ] Logo and footer slots
- [ ] Topbar.tsx implemented
  - [ ] User info display
  - [ ] Avatar or initials
  - [ ] Notification badge
  - [ ] User dropdown menu
  - [ ] Logout, profile, settings actions
- [ ] MobileNav.tsx implemented
  - [ ] Overlay backdrop
  - [ ] Slide-in drawer
  - [ ] Auto-close on navigation
- [ ] All 30 test cases pass
- [ ] 100% code coverage
- [ ] Accessibility (roles, aria attributes)
