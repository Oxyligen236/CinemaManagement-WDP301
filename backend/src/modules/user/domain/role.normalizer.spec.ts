import { Role } from './enums/role.enum';
import {
  BRANCH_MANAGER_ROLE_VALUES,
  isBranchManagerRole,
  normalizeRole,
} from './role.normalizer';

describe('normalizeRole', () => {
  it.each(['MANAGER', 'BRANCHMANAGER', 'BRANCH_MANAGER'])(
    'maps legacy value %s to Role.BRANCHMANAGER',
    (value) => {
      expect(normalizeRole(value)).toBe(Role.BRANCHMANAGER);
    },
  );

  it.each([Role.ADMIN, Role.STAFF, Role.USER])('keeps %s as-is', (role) => {
    expect(normalizeRole(role)).toBe(role);
  });

  it('is case-insensitive and ignores surrounding spaces', () => {
    expect(normalizeRole(' manager ')).toBe(Role.BRANCHMANAGER);
    expect(normalizeRole('admin')).toBe(Role.ADMIN);
  });

  it.each([undefined, null, '', 'UNKNOWN_ROLE'])(
    'returns undefined for %s',
    (value) => {
      expect(normalizeRole(value)).toBeUndefined();
    },
  );
});

describe('isBranchManagerRole', () => {
  it('accepts every value the database may hold for Branch Manager', () => {
    for (const value of BRANCH_MANAGER_ROLE_VALUES) {
      expect(isBranchManagerRole(value)).toBe(true);
    }
  });

  it.each([Role.ADMIN, Role.STAFF, Role.USER])('rejects %s', (role) => {
    expect(isBranchManagerRole(role)).toBe(false);
  });

  it('rejects a missing role', () => {
    expect(isBranchManagerRole(undefined)).toBe(false);
  });
});
