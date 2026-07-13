import React from 'react';
import { cn } from '@/utils/cn';

const SECTIONS = [
  { id: 'basic', label: 'Thông tin cơ bản', icon: '📦' },
  { id: 'specs', label: 'Thuộc tính kỹ thuật', icon: '⚙️' },
  { id: 'sales', label: 'Thông tin bán hàng', icon: '🛒' },
  { id: 'logistics', label: 'Vận chuyển', icon: '🚚' },
  { id: 'other', label: 'Thông tin khác', icon: '📋' },
  { id: 'channels', label: 'Cấu hình đa kênh', icon: '🌐' },
];

interface ProductFormSidebarProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  completionPercent: number;
  sectionErrors: Record<string, number>;
}

export function ProductFormSidebar({
  activeSection,
  onSectionClick,
  completionPercent,
  sectionErrors,
}: ProductFormSidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 sticky top-6 self-start">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Progress */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Hoàn thành</span>
            <span className="font-semibold text-brand-primary">{completionPercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-primary rounded-full transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="py-2">
          {SECTIONS.map(section => {
            const errorCount = sectionErrors[section.id] || 0;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionClick(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-[3px]",
                  activeSection === section.id
                    ? "border-brand-primary bg-blue-50 text-brand-primary font-semibold"
                    : "border-transparent text-gray-600 hover:bg-gray-50",
                  errorCount > 0 && "bg-rose-50 border-rose-400"
                )}
              >
                <span>{section.icon}</span>
                <span className="flex-1 text-left">{section.label}</span>
                {errorCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full">
                    {errorCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
