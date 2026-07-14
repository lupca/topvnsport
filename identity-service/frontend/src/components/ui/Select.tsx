import React, { forwardRef } from "react";

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, helperText, options, placeholder, children, id, ...props }, ref) => {
    // Generate unique ID for label coupling if not provided
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-gray-700 mb-1.5">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative rounded-xl shadow-sm">
          <select
            ref={ref}
            id={selectId}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-surface text-gray-900 transition-all focus:outline-none focus:ring-2 placeholder:text-gray-400 appearance-none
              ${error 
                ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500" 
                : "border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              }
              ${props.disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
        
        {error && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>
        )}
        
        {!error && helperText && (
          <p className="mt-1 text-[11px] text-gray-500 leading-normal">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
