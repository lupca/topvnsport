import React, { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { cn } from '@/utils/cn';
import { Link2, Unlink, RefreshCw } from 'lucide-react';

interface InheritedFieldProps {
  masterFieldName: string;  // e.g., "name"
  overrideFieldName: string; // e.g., "channel_listings.0.title_override"
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

export function InheritedField({
  masterFieldName,
  overrideFieldName,
  label,
  multiline = false,
  placeholder,
}: InheritedFieldProps) {
  const { register, setValue, watch } = useFormContext();
  
  const masterValue = watch(masterFieldName);
  const overrideValue = watch(overrideFieldName);
  
  const isOverriding = !!overrideValue && overrideValue.trim() !== '';
  
  // Effective value that will be used
  const effectiveValue = isOverriding ? overrideValue : masterValue;

  const handleResetToMaster = () => {
    setValue(overrideFieldName, '', { shouldDirty: true });
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        
        <div className="flex items-center gap-2">
          {isOverriding ? (
            <>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Unlink className="h-3 w-3" />
                Tùy chỉnh
              </span>
              <button
                type="button"
                onClick={handleResetToMaster}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title="Reset về giá trị gốc"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
            </>
          ) : (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Từ master
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <InputComponent
          {...register(overrideFieldName)}
          placeholder={masterValue || placeholder || 'Nhập giá trị tùy chỉnh...'}
          className={cn(
            "pim-input w-full",
            multiline && "min-h-[100px] resize-y",
            !isOverriding && "bg-gray-50 text-gray-500"
          )}
          rows={multiline ? 4 : undefined}
        />
      </div>

      {/* Preview of effective value */}
      {!isOverriding && masterValue && (
        <p className="text-xs text-gray-500 mt-1">
          Giá trị sẽ dùng: <span className="font-medium">{masterValue.substring(0, 100)}{masterValue.length > 100 ? '...' : ''}</span>
        </p>
      )}
    </div>
  );
}
