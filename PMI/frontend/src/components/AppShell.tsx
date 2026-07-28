'use client';

import { AuthGuard } from './AuthGuard';
import { ErrorBoundary } from './ErrorBoundary';
import DashboardLayout from './layout/DashboardLayout';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <DashboardLayout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </DashboardLayout>
    </AuthGuard>
  );
}

export default AppShell;
