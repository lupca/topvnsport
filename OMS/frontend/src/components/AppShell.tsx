'use client';

import { AuthGuard } from './AuthGuard';
import DashboardLayout from './layout/DashboardLayout';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthGuard>
  );
}

export default AppShell;
