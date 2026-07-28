'use client';

import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface PageErrorBoundaryProps {
  children: ReactNode;
}

export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-800">Đã xảy ra lỗi</h1>
            <p className="mb-6 text-gray-600">Trang không thể tải. Vui lòng thử lại.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default PageErrorBoundary;
