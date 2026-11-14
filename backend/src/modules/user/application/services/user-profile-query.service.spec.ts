import { NotFoundException } from '@nestjs/common';
import { UserProfileQueryService } from './user-profile-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('UserProfileQueryService', () => {
  let service: UserProfileQueryService;
  let mockPrisma: any;

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
      },
    };
    service = new UserProfileQueryService(mockPrisma);
  });

  it('returns UserProfileRes when user exists and is active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.execute('user-1');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { branch: true },
    });
    expect(result.id).toBe('user-1');
    expect(result.email).toBe('user1@example.com');
    expect(result.firstName).toBe('Van A');
    expect(result.lastName).toBe('Nguyen');
    expect(result.role).toBe('USER');
    expect(result.branchId).toBeNull();
    expect(result.branchName).toBeNull();
  });

  it('includes branchName when user has an assigned branch', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      branchId: 'b-1',
      branch: { branchName: 'Cinema Q1' },
    });

    const result = await service.execute('user-1');

    expect(result.branchId).toBe('b-1');
    expect(result.branchName).toBe('Cinema Q1');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.execute('ghost-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when user is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    await expect(service.execute('user-1')).rejects.toThrow(NotFoundException);
  });
});
