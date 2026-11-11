import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordReq, UpdateProfileReq } from './req.dto';

describe('User DTO Validation', () => {
  describe('UpdateProfileReq', () => {
    it('accepts valid firstName and lastName', async () => {
      const dto = plainToInstance(UpdateProfileReq, {
        firstName: '  Van A  ',
        lastName: '  Nguyen  ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.firstName).toBe('Van A');
      expect(dto.lastName).toBe('Nguyen');
    });

    it('accepts empty object when fields are omitted (optional)', async () => {
      const dto = plainToInstance(UpdateProfileReq, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects empty string after trim for firstName', async () => {
      const dto = plainToInstance(UpdateProfileReq, {
        firstName: '    ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints?.isNotEmpty).toBe('Tên không được để trống');
    });

    it('rejects empty string after trim for lastName', async () => {
      const dto = plainToInstance(UpdateProfileReq, {
        lastName: '    ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('lastName');
      expect(errors[0].constraints?.isNotEmpty).toBe('Họ không được để trống');
    });

    it('rejects firstName exceeding 50 characters', async () => {
      const dto = plainToInstance(UpdateProfileReq, {
        firstName: 'a'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints?.maxLength).toBe(
        'Tên không được vượt quá 50 ký tự',
      );
    });
  });

  describe('ChangePasswordReq', () => {
    it('accepts valid password between 8 and 64 characters', async () => {
      const dto = plainToInstance(ChangePasswordReq, {
        currentPassword: 'currentPassword123',
        newPassword: 'newPassword123',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts newPassword with exactly 8 and 64 characters', async () => {
      const dto8 = plainToInstance(ChangePasswordReq, {
        currentPassword: 'currentPassword123',
        newPassword: 'a'.repeat(8),
      });
      expect(await validate(dto8)).toHaveLength(0);

      const dto64 = plainToInstance(ChangePasswordReq, {
        currentPassword: 'currentPassword123',
        newPassword: 'a'.repeat(64),
      });
      expect(await validate(dto64)).toHaveLength(0);
    });

    it('rejects newPassword shorter than 8 characters', async () => {
      const dto = plainToInstance(ChangePasswordReq, {
        currentPassword: 'currentPassword123',
        newPassword: 'short',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.minLength).toBe(
        'Mật khẩu mới phải có tối thiểu 8 ký tự',
      );
    });

    it('rejects newPassword longer than 64 characters', async () => {
      const dto = plainToInstance(ChangePasswordReq, {
        currentPassword: 'currentPassword123',
        newPassword: 'a'.repeat(65),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.maxLength).toBe(
        'Mật khẩu mới không được vượt quá 64 ký tự',
      );
    });

    it('rejects empty currentPassword', async () => {
      const dto = plainToInstance(ChangePasswordReq, {
        currentPassword: '',
        newPassword: 'newPassword123',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('currentPassword');
    });
  });
});
