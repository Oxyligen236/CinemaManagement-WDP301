import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtGuard } from './jwt.guard';
import { Role } from '../decorators/role.decorator';

const buildContext = (headers: Record<string, string>) => {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
};

describe('JwtGuard', () => {
  let verifyAsync: jest.Mock;
  let guard: JwtGuard;

  beforeEach(() => {
    verifyAsync = jest.fn();
    guard = new JwtGuard({ verifyAsync } as unknown as JwtService);
  });

  it('rejects when Authorization header is missing', async () => {
    const { context } = buildContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects when scheme is not Bearer', async () => {
    const { context } = buildContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when token is invalid or expired', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = buildContext({ authorization: 'Bearer bad' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Unauthorized'),
    );
  });

  it('sets request.user from the token payload', async () => {
    verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@cinema.local',
      role: Role.ADMIN,
    });
    const { context, request } = buildContext({ authorization: 'Bearer ok' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('ok');
    expect(request.user).toEqual({
      userId: 'admin-1',
      email: 'admin@cinema.local',
      role: Role.ADMIN,
    });
  });
});
