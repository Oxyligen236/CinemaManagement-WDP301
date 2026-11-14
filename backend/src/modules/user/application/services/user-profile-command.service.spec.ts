import { NotFoundException } from '@nestjs/common';
import { UserProfileCommandService } from './user-profile-command.service';

describe('UserProfileCommandService', () => {
  let service: UserProfileCommandService;
  let mockPrisma: any;
  let mockEventEmitter: any;

  const mockUser = {
    id: 'user-1',
    email: 'user1@example.com',
    firstName: 'Van A',
    lastName: 'Nguyen',
    role: 'USER',
    branchId: null,
    jobPosition: null,
    employmentStatus: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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
    service = new UserProfileCommandService(mockPrisma, mockEventEmitter);
  });

  it('updates profile and returns updated UserProfileRes', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      firstName: 'Van B',
      lastName: 'Tran',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await service.execute('user-1', {
      firstName: 'Van B',
      lastName: 'Tran',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        firstName: 'Van B',
        lastName: 'Tran',
      },
      include: { branch: true },
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'user.profile.updated',
      expect.objectContaining({
        userId: 'user-1',
        updatedFields: {
          firstName: 'Van B',
          lastName: 'Tran',
        },
      }),
    );
    expect(result.firstName).toBe('Van B');
    expect(result.lastName).toBe('Tran');
  });

  it('updates only provided fields', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      firstName: 'Van C',
    });

    await service.execute('user-1', {
      firstName: 'Van C',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        firstName: 'Van C',
      },
      include: { branch: true },
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'user.profile.updated',
      expect.objectContaining({
        userId: 'user-1',
        updatedFields: {
          firstName: 'Van C',
        },
      }),
    );
  });

  it('throws NotFoundException when user not found or inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.execute('ghost-user', { firstName: 'Test' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();

    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    await expect(
      service.execute('user-1', { firstName: 'Test' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('updates only lastName when firstName is omitted and includes branchName when present', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      branchId: 'b-1',
      branch: { branchName: 'Cinema Q1' },
      lastName: 'Pham',
    });

    const result = await service.execute('user-1', { lastName: 'Pham' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastName: 'Pham' },
      include: { branch: true },
    });
    expect(result.lastName).toBe('Pham');
    expect(result.branchName).toBe('Cinema Q1');
  });
});
