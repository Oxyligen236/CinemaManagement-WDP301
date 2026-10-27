import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      className = '',
      containerClassName = '',
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const inputClasses = `h-10 w-full rounded-lg border ${
      error ? 'border-status-danger focus:border-status-danger focus:ring-status-danger' : 'border-border-main focus:border-primary-600 focus:ring-primary-600'
    } bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 disabled:bg-surface-muted disabled:cursor-not-allowed ${className}`;

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-main">
            {label}
            {required && <span className="text-status-danger ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={inputClasses}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-status-danger" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
