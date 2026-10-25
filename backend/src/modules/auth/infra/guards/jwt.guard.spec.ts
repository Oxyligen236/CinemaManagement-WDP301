import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { JwtGuard } from './jwt.guard';
import { Role } from '../decorators/role.decorator';
import { UserDocument } from '../../../user/domain/schemas/user.schema';

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
  let findExec: jest.Mock;
  let guard: JwtGuard;

  beforeEach(() => {
    verifyAsync = jest.fn();
    findExec = jest.fn();
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: findExec,
    };
    const userModel = {
      findOne: jest.fn().mockReturnValue(query),
    } as unknown as Model<UserDocument>;
    guard = new JwtGuard({ verifyAsync } as unknown as JwtService, userModel);
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
      new UnauthorizedException('Invalid or expired access token'),
    );
  });

  it('rejects when the account is inactive or role/tokenVersion changed', async () => {
    verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@cinema.local',
      role: Role.ADMIN,
      tokenVersion: 0,
    });
    findExec.mockResolvedValue({
      isActive: true,
      role: Role.ADMIN,
      tokenVersion: 1,
    });
    const { context } = buildContext({ authorization: 'Bearer ok' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Account access has been revoked'),
    );
  });

  it('sets request.user from the token payload', async () => {
    const payload = {
      sub: 'admin-1',
      email: 'admin@cinema.local',
      role: Role.ADMIN,
      tokenVersion: 0,
    };
    verifyAsync.mockResolvedValue(payload);
    findExec.mockResolvedValue({
      isActive: true,
      role: Role.ADMIN,
      tokenVersion: 0,
    });
    const { context, request } = buildContext({ authorization: 'Bearer ok' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('ok');
    expect(request.user).toEqual(payload);
  });
});
