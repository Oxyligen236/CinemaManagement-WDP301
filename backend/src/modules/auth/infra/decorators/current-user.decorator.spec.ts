import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Role } from './role.decorator';
import { CurrentUser, toAuthenticatedUser } from './current-user.decorator';

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

  it('falls back to empty string when both userId and sub are missing', () => {
    expect(
      toAuthenticatedUser({
        email: 'anon@example.com',
        role: Role.USER,
      }),
    ).toEqual({
      userId: '',
      email: 'anon@example.com',
      role: Role.USER,
    });
  });

  it('returns undefined when there is no user', () => {
    expect(toAuthenticatedUser(undefined)).toBeUndefined();
  });
});

describe('CurrentUser decorator', () => {
  class DummyController {
    handler(@CurrentUser() user: unknown) {
      return user;
    }
  }

  const getParamDecoratorFactory = () => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      DummyController,
      'handler',
    ) as Record<string, { factory: (data: unknown, ctx: ExecutionContext) => unknown }>;
    return Object.values(args)[0].factory;
  };

  it('extracts and normalizes request.user from ExecutionContext', () => {
    const factory = getParamDecoratorFactory();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: 'user-99',
            email: 'staff@example.com',
            role: Role.STAFF,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, ctx)).toEqual({
      userId: 'user-99',
      email: 'staff@example.com',
      role: Role.STAFF,
    });
  });

  it('returns undefined when request.user is absent', () => {
    const factory = getParamDecoratorFactory();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, ctx)).toBeUndefined();
  });
});
