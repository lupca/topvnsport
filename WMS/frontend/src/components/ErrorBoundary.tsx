'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="font-semibold text-red-800">Đã xảy ra lỗi</h2>
        <p className="mt-1 text-sm text-red-600">
          Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp diễn.
        </p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-3 rounded bg-red-100 px-3 py-1 text-sm text-red-800 hover:bg-red-200"
        >
          Thử lại
        </button>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre className="mt-3 overflow-auto rounded bg-red-100 p-2 text-xs">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
