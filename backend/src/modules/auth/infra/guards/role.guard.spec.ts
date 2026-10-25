import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from './role.guard';
import { Role, Roles } from '../decorators/role.decorator';

const buildContext = (user?: { role: Role }) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RoleGuard', () => {
  let getAllAndOverride: jest.Mock;
  let guard: RoleGuard;

  beforeEach(() => {
    getAllAndOverride = jest.fn();
    guard = new RoleGuard({ getAllAndOverride } as unknown as Reflector);
  });

  it('allows when no roles are declared', () => {
    getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('allows ADMIN when ADMIN is required', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(buildContext({ role: Role.ADMIN }))).toBe(true);
  });

  it.each([Role.BRANCHMANAGER, Role.STAFF, Role.USER])(
    'forbids %s when ADMIN is required',
    (role) => {
      getAllAndOverride.mockReturnValue([Role.ADMIN]);
      expect(() => guard.canActivate(buildContext({ role }))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('forbids when request has no user', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(buildContext())).toThrow(
      new ForbiddenException(
        'You do not have permission to access this resource.',
      ),
    );
  });

  it('allows MANAGER when ADMIN and MANAGER are required', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN, Role.BRANCHMANAGER]);
    expect(guard.canActivate(buildContext({ role: Role.BRANCHMANAGER }))).toBe(
      true,
    );
    expect(guard.canActivate(buildContext({ role: Role.ADMIN }))).toBe(true);
  });

  it.each([Role.STAFF, Role.USER])(
    'forbids %s when ADMIN and MANAGER are required',
    (role) => {
      getAllAndOverride.mockReturnValue([Role.ADMIN, Role.BRANCHMANAGER]);
      expect(() => guard.canActivate(buildContext({ role }))).toThrow(
        ForbiddenException,
      );
    },
  );

  describe('with real Reflector metadata', () => {
    @Roles(Role.ADMIN)
    class SampleController {
      @Roles(Role.ADMIN, Role.BRANCHMANAGER)
      overridden() {}

      inherited() {}
    }

    const handlerOf = (name: 'overridden' | 'inherited'): (() => void) =>
      Object.getOwnPropertyDescriptor(SampleController.prototype, name)!
        .value as () => void;

    const realGuard = new RoleGuard(new Reflector());
    const contextFor = (handler: () => void, role: Role) =>
      ({
        getHandler: () => handler,
        getClass: () => SampleController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as unknown as ExecutionContext;

    it('handler-level roles override class-level roles', () => {
      expect(
        realGuard.canActivate(
          contextFor(handlerOf('overridden'), Role.BRANCHMANAGER),
        ),
      ).toBe(true);
    });

    it('falls back to class-level roles when the handler has none', () => {
      expect(
        realGuard.canActivate(contextFor(handlerOf('inherited'), Role.ADMIN)),
      ).toBe(true);
      expect(() =>
        realGuard.canActivate(
          contextFor(handlerOf('inherited'), Role.BRANCHMANAGER),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
