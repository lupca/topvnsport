'use client';

import { useEffect, useState } from 'react';
import { getAccessToken, verifyToken, refreshAccessToken, redirectToLogin, handleAuthCallback } from '@/utils/auth';
import '@/utils/apiClient'; // Enable global fetch interception for JWT auth

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      // Handle callback from Identity Service
      if (handleAuthCallback()) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        redirectToLogin();
        return;
      }

      // Verify token
      const isValid = await verifyToken(token);

      if (isValid) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Try refresh
      const newToken = await refreshAccessToken();
      if (newToken) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // All failed, redirect to login
      redirectToLogin();
    }

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
