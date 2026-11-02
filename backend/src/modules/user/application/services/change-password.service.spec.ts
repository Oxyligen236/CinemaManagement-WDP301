import { BadRequestException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { ChangePasswordService } from './change-password.service';

describe('ChangePasswordService', () => {
  let service: ChangePasswordService;
  let mockPrisma: any;
  let mockEventEmitter: any;

  const OLD_PASSWORD = 'OldPassword@123';
  const NEW_PASSWORD = 'NewPassword@456';

  const mockUser = {
    id: 'user-1',
    email: 'user1@example.com',
    password: bcrypt.hashSync(OLD_PASSWORD, 4),
    isActive: true,
    tokenVersion: 1,
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    service = new ChangePasswordService(mockPrisma, mockEventEmitter);
  });

  it('updates password and increments tokenVersion on valid request', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      tokenVersion: 2,
    });

    const result = await service.execute('user-1', {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: expect.any(String),
        tokenVersion: { increment: 1 },
      },
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'user.password.changed',
      expect.objectContaining({
        userId: 'user-1',
        changedAt: expect.any(Date),
      }),
    );
    expect(result.message).toContain('Đổi mật khẩu thành công');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.execute('ghost-user', {
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    await expect(
      service.execute('user-1', {
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when currentPassword is wrong', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.execute('user-1', {
        currentPassword: 'WrongPassword@999',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow(
      new BadRequestException('Mật khẩu hiện tại không chính xác'),
    );
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when newPassword is identical to currentPassword', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.execute('user-1', {
        currentPassword: OLD_PASSWORD,
        newPassword: OLD_PASSWORD,
      }),
    ).rejects.toThrow(
      new BadRequestException('Mật khẩu mới không được trùng mật khẩu cũ'),
    );
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });
});
