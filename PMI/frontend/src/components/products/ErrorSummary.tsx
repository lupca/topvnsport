import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorSummaryProps {
  errors: string[];
  totalCount: number;
}

export function ErrorSummary({ errors, totalCount }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-rose-900">
            Có {totalCount} lỗi cần sửa
          </h4>
          <ul className="mt-2 space-y-1">
            {errors.map((msg, i) => (
              <li key={i} className="text-sm text-rose-700 flex items-start gap-2">
                <span className="text-rose-400 mt-1">•</span>
                <span>{msg}</span>
              </li>
            ))}
            {totalCount > errors.length && (
              <li className="text-sm text-rose-600 italic">
                ...và {totalCount - errors.length} lỗi khác
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
