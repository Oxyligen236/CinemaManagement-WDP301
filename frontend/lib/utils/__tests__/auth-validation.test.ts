import { describe, expect, it } from 'vitest';
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  VERIFICATION_CODE_LENGTH,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
  validateVerificationCode,
} from '@/lib/utils/auth-validation';

describe('lib/utils/auth-validation', () => {
  it('exports expected DTO-aligned constants', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(72);
    expect(NAME_MAX_LENGTH).toBe(100);
    expect(VERIFICATION_CODE_LENGTH).toBe(6);
  });

  describe('validateEmail', () => {
    it('returns required error when empty or whitespace', () => {
      expect(validateEmail('')).toBe('Vui lòng nhập email.');
      expect(validateEmail('   ')).toBe('Vui lòng nhập email.');
    });

    it('returns format error for invalid emails including numeric TLD', () => {
      expect(validateEmail('invalid')).toBe('Email không đúng định dạng.');
      expect(validateEmail('a@b')).toBe('Email không đúng định dạng.');
      expect(validateEmail('a@b.c')).toBe('Email không đúng định dạng.');
      expect(validateEmail('minh@gmail.com1')).toBe('Email không đúng định dạng.');
      expect(validateEmail('minh@gmail.co1m')).toBe('Email không đúng định dạng.');
      expect(validateEmail('a b@gmail.com')).toBe('Email không đúng định dạng.');
      expect(validateEmail('@gmail.com')).toBe('Email không đúng định dạng.');
      expect(validateEmail('user@.com')).toBe('Email không đúng định dạng.');
    });

    it('returns undefined for valid emails even with surrounding spaces', () => {
      expect(validateEmail('user@example.com')).toBeUndefined();
      expect(validateEmail('  minh.nguyen+vip@mail.sub.vn  ')).toBeUndefined();
    });
  });

  describe('validateName', () => {
    it('returns required error with lowercased label when empty or whitespace', () => {
      expect(validateName('', 'Họ')).toBe('Vui lòng nhập họ.');
      expect(validateName('   ', 'Tên')).toBe('Vui lòng nhập tên.');
    });

    it('returns max length error when trimmed name exceeds 100 chars', () => {
      expect(validateName('a'.repeat(101), 'Họ')).toBe(
        'Họ không được vượt quá 100 ký tự.',
      );
    });

    it('returns undefined when trimmed name is within 1..100 chars', () => {
      expect(validateName(`  ${'a'.repeat(100)}  `, 'Họ')).toBeUndefined();
      expect(validateName('Nguyễn Văn A', 'Tên')).toBeUndefined();
    });
  });

  describe('validatePassword', () => {
    it('returns required error with default and custom label when empty', () => {
      expect(validatePassword('')).toBe('Vui lòng nhập mật khẩu.');
      expect(validatePassword('', { label: 'Mật khẩu mới' })).toBe(
        'Vui lòng nhập mật khẩu mới.',
      );
    });

    it('returns min length error when shorter than 8 characters', () => {
      expect(validatePassword('1234567')).toBe(
        'Mật khẩu phải có tối thiểu 8 ký tự.',
      );
      expect(validatePassword('abc', { label: 'Mật khẩu mới' })).toBe(
        'Mật khẩu mới phải có tối thiểu 8 ký tự.',
      );
    });

    it('enforces max length 72 by default and allows skipping via enforceMaxLength=false', () => {
      const overMax = 'a'.repeat(73);
      expect(validatePassword(overMax)).toBe(
        'Mật khẩu không được vượt quá 72 ký tự.',
      );
      expect(
        validatePassword(overMax, { label: 'Mật khẩu mới', enforceMaxLength: true }),
      ).toBe('Mật khẩu mới không được vượt quá 72 ký tự.');
      expect(
        validatePassword(overMax, { enforceMaxLength: false }),
      ).toBeUndefined();
    });

    it('returns undefined at min and max boundaries', () => {
      expect(validatePassword('12345678')).toBeUndefined();
      expect(validatePassword('a'.repeat(72))).toBeUndefined();
    });
  });

  describe('validateConfirmPassword', () => {
    it('returns required error when empty', () => {
      expect(validateConfirmPassword('', 'secret123')).toBe(
        'Vui lòng nhập lại mật khẩu.',
      );
    });

    it('returns mismatch error when values differ', () => {
      expect(validateConfirmPassword('secret124', 'secret123')).toBe(
        'Mật khẩu xác nhận không khớp.',
      );
    });

    it('returns undefined when values match', () => {
      expect(validateConfirmPassword('secret123', 'secret123')).toBeUndefined();
    });
  });

  describe('validateVerificationCode', () => {
    it('returns required error when empty or whitespace', () => {
      expect(validateVerificationCode('')).toBe('Vui lòng nhập mã xác thực.');
      expect(validateVerificationCode('   ')).toBe('Vui lòng nhập mã xác thực.');
    });

    it('returns format error when trimmed value is not exactly 6 digits', () => {
      expect(validateVerificationCode('12345')).toBe(
        'Mã xác thực phải gồm đúng 6 chữ số.',
      );
      expect(validateVerificationCode('1234567')).toBe(
        'Mã xác thực phải gồm đúng 6 chữ số.',
      );
      expect(validateVerificationCode('12345a')).toBe(
        'Mã xác thực phải gồm đúng 6 chữ số.',
      );
      expect(validateVerificationCode('abcdef')).toBe(
        'Mã xác thực phải gồm đúng 6 chữ số.',
      );
    });

    it('returns undefined for exactly 6 digits with optional surrounding spaces', () => {
      expect(validateVerificationCode('123456')).toBeUndefined();
      expect(validateVerificationCode('  098765  ')).toBeUndefined();
    });
  });
});
