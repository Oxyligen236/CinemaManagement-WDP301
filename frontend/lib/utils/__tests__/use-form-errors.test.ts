import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type FieldErrors, useFormErrors } from '@/lib/utils/use-form-errors';

interface LoginFormValues {
  email: string;
  password: string;
}

const validateLogin = (values: LoginFormValues): FieldErrors<LoginFormValues> => {
  const errors: FieldErrors<LoginFormValues> = {};
  if (!values.email.trim()) errors.email = 'Email bắt buộc';
  if (values.password.length < 8) errors.password = 'Mật khẩu tối thiểu 8 ký tự';
  return errors;
};

describe('lib/utils/use-form-errors', () => {
  it('initializes with empty fieldErrors', () => {
    const { result } = renderHook(() => useFormErrors(validateLogin));
    expect(result.current.fieldErrors).toEqual({});
  });

  it('sets and clears individual field error with validateField', () => {
    const { result } = renderHook(() => useFormErrors(validateLogin));

    act(() => {
      result.current.validateField({ email: '', password: '123' }, 'email');
    });
    expect(result.current.fieldErrors).toEqual({ email: 'Email bắt buộc' });

    act(() => {
      result.current.validateField({ email: '', password: '123' }, 'password');
    });
    expect(result.current.fieldErrors).toEqual({
      email: 'Email bắt buộc',
      password: 'Mật khẩu tối thiểu 8 ký tự',
    });

    act(() => {
      result.current.validateField(
        { email: 'user@example.com', password: '123' },
        'email',
      );
    });
    expect(result.current.fieldErrors).toEqual({
      password: 'Mật khẩu tối thiểu 8 ký tự',
    });

    const prevRef = result.current.fieldErrors;
    act(() => {
      result.current.validateField(
        { email: 'user@example.com', password: '123' },
        'email',
      );
    });
    expect(result.current.fieldErrors).toBe(prevRef);
  });

  it('clears a single field error with clearFieldError and skips when already clean', () => {
    const { result } = renderHook(() => useFormErrors(validateLogin));

    const initialRef = result.current.fieldErrors;
    act(() => {
      result.current.clearFieldError('email');
    });
    expect(result.current.fieldErrors).toBe(initialRef);

    act(() => {
      result.current.setFieldErrors({
        email: 'Email sai',
        password: 'Mật khẩu sai',
      });
    });

    act(() => {
      result.current.clearFieldError('email');
    });
    expect(result.current.fieldErrors).toEqual({ password: 'Mật khẩu sai' });
  });

  it('validates all fields and returns boolean status in validateAll', () => {
    const { result } = renderHook(() => useFormErrors(validateLogin));

    let isValid = true;
    act(() => {
      isValid = result.current.validateAll({ email: '', password: 'short' });
    });
    expect(isValid).toBe(false);
    expect(result.current.fieldErrors).toEqual({
      email: 'Email bắt buộc',
      password: 'Mật khẩu tối thiểu 8 ký tự',
    });

    act(() => {
      isValid = result.current.validateAll({
        email: 'valid@example.com',
        password: 'password123',
      });
    });
    expect(isValid).toBe(true);
    expect(result.current.fieldErrors).toEqual({});
  });
});
