import React, { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, leftIcon, rightIcon, type = "text", id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const actualType = isPassword ? (showPassword ? "text" : "password") : type;

    // Generate unique ID for label coupling if not provided
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-gray-700 mb-1.5">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative rounded-xl shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-surface text-gray-900 transition-all focus:outline-none focus:ring-2 placeholder:text-gray-400
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon || isPassword ? "pr-10" : ""}
              ${error 
                ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500" 
                : "border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              }
              ${props.disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}
              ${className}
            `}
            {...props}
          />
          
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : rightIcon ? (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
              {rightIcon}
            </div>
          ) : null}
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

Input.displayName = "Input";

export default Input;
