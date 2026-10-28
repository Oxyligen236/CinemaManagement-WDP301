import { Role } from './role.decorator';
import { toAuthenticatedUser } from './current-user.decorator';

describe('toAuthenticatedUser', () => {
  it('maps the JWT payload `sub` to `userId`', () => {
    expect(
      toAuthenticatedUser({
        sub: 'user-1',
        email: 'manager@example.com',
        role: Role.BRANCHMANAGER,
      }),
    ).toEqual({
      userId: 'user-1',
      email: 'manager@example.com',
      role: Role.BRANCHMANAGER,
    });
  });

  it('keeps an existing `userId`', () => {
    expect(
      toAuthenticatedUser({
        userId: 'user-2',
        email: 'a@example.com',
        role: Role.ADMIN,
      })?.userId,
    ).toBe('user-2');
  });

  it('returns undefined when there is no user', () => {
    expect(toAuthenticatedUser(undefined)).toBeUndefined();
  });
});
