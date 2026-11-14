import { EmploymentStatus } from '../../user/domain/enums/employment-status.enum';
import {
  isLoginAllowed,
  resolveEmploymentStatus,
  staffBadRequestBody,
  staffConflictBody,
} from './staff.rules';

describe('staff.rules', () => {
  describe('resolveEmploymentStatus', () => {
    it('returns ACTIVE when isActive is true regardless of stored status', () => {
      expect(resolveEmploymentStatus(true, EmploymentStatus.INACTIVE)).toBe(
        EmploymentStatus.ACTIVE,
      );
      expect(resolveEmploymentStatus(true, undefined)).toBe(
        EmploymentStatus.ACTIVE,
      );
    });

    it('returns RESIGNED when isActive is false and stored is RESIGNED', () => {
      expect(resolveEmploymentStatus(false, EmploymentStatus.RESIGNED)).toBe(
        EmploymentStatus.RESIGNED,
      );
    });

    it('returns INACTIVE when isActive is false and stored is not RESIGNED', () => {
      expect(resolveEmploymentStatus(false, EmploymentStatus.INACTIVE)).toBe(
        EmploymentStatus.INACTIVE,
      );
      expect(resolveEmploymentStatus(false, undefined)).toBe(
        EmploymentStatus.INACTIVE,
      );
    });
  });

  describe('isLoginAllowed', () => {
    it('allows only ACTIVE status', () => {
      expect(isLoginAllowed(EmploymentStatus.ACTIVE)).toBe(true);
      expect(isLoginAllowed(EmploymentStatus.INACTIVE)).toBe(false);
      expect(isLoginAllowed(EmploymentStatus.RESIGNED)).toBe(false);
    });
  });

  describe('error body helpers', () => {
    it('builds 400 and 409 field error responses', () => {
      expect(staffBadRequestBody('jobPosition', 'invalid')).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'invalid',
        errors: ['invalid'],
        fields: ['jobPosition'],
        fieldErrors: { jobPosition: 'invalid' },
      });
      expect(staffConflictBody('email', 'dup')).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'dup',
        errors: ['dup'],
        fields: ['email'],
        fieldErrors: { email: 'dup' },
      });
    });
  });
});
