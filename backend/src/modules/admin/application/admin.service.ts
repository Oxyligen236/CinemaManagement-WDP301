/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Role, BranchStatus } from '@prisma/client';
import { AuthUser } from '../../auth/domain/auth-user';
import {
  CreateUserDto,
  AssignBranchDto,
  ManageUsersQueryDto,
  UpdateUserDto,
} from './dto/manage-user.dto';
import { REGISTRATION_MESSAGES } from '../../user/domain/constants/auth-message.constants';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(authUser: AuthUser) {
    const admin = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
    });

    if (!admin || !admin.isActive || admin.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const [totalUsers, activeUsers, roleGroups] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const usersByRole = Object.fromEntries(
      Object.values(Role).map((role) => [role, 0]),
    ) as Record<Role, number>;
    for (const g of roleGroups) {
      usersByRole[g.role] = g._count.id;
    }

    return {
      message: `Welcome back, ${admin.firstName} ${admin.lastName}`,
      admin: {
        userId: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole,
      },
    };
  }

  async getUsers(query: ManageUsersQueryDto) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const docs = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const users = docs.map((u: any) => ({
      ...u,
      userId: u.id,
    }));

    return { users, total: users.length };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user: { ...user, userId: user.id } };
  }

  async getActiveBranches() {
    const branches = await this.prisma.branch.findMany({
      where: { branchStatus: BranchStatus.ACTIVE },
      select: {
        id: true,
        branchName: true,
        address: true,
        branchStatus: true,
      },
      orderBy: { branchName: 'asc' },
    });

    return {
      branches: branches.map((b: any) => ({
        ...b,
        branchId: b.id,
      })),
    };
  }

  async assignBranch(
    userId: string,
    input: AssignBranchDto,
    adminUserId: string,
  ) {
    if (userId === adminUserId) {
      throw new ForbiddenException(
        'You cannot assign a branch to your own account',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, role: true, isActive: true, branchId: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) {
      throw new BadRequestException(
        'Cannot assign branch to an inactive account',
      );
    }
    if (user.role !== Role.MANAGER && user.role !== Role.STAFF) {
      throw new BadRequestException(
        'Only Branch Manager or Staff accounts can be assigned to a branch',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: input.branchId,
        branchStatus: BranchStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new BadRequestException(
        'Selected branch is inactive and cannot be assigned.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        branchId: input.branchId,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Update asset(s) successfully.',
      user: { ...updatedUser, userId: updatedUser.id },
    };
  }

  async createUser(input: CreateUserDto) {
    const email = input.email.toLowerCase();
    if (input.branchId) {
      if (
        input.isActive === false ||
        (input.role !== Role.MANAGER && input.role !== Role.STAFF)
      ) {
        throw new BadRequestException(
          'Only Branch Manager or Staff accounts can be assigned to a branch',
        );
      }
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: input.branchId,
          branchStatus: BranchStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException(
          'Selected branch is inactive and cannot be assigned.',
        );
      }
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(input.password, 10),
          firstName: input.firstName,
          lastName: input.lastName,
          role: (input.role as Role) ?? Role.USER,
          isActive: input.isActive ?? true,
          branchId: input.branchId || undefined,
        },
      });

      return {
        message: 'User created successfully',
        user: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          branchId: user.branchId,
        },
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Username must be unique across the entire system.',
        );
      }
      throw error;
    }
  }

  async updateUser(userId: string, input: UpdateUserDto, adminUserId: string) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    if (userId === adminUserId) {
      const self = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!self) {
        throw new NotFoundException('User not found');
      }

      if (input.role !== undefined && (input.role as unknown as Role) !== self.role) {
        throw new ForbiddenException('You cannot change your own role');
      }

      if (input.isActive === false) {
        throw new ForbiddenException('You cannot disable your own account');
      }
    }

    if (input.email) {
      input.email = input.email.toLowerCase();
    }

    const clearBranch =
      input.role !== undefined &&
      input.role !== Role.MANAGER &&
      input.role !== Role.STAFF;

    const data: any = { ...input };
    if (clearBranch) {
      data.branchId = null;
    }
    if (input.isActive === false) {
      data.tokenVersion = { increment: 1 };
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          branchId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { message: 'User updated successfully', user: { ...user, userId: user.id } };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          REGISTRATION_MESSAGES.EMAIL_ALREADY_REGISTERED,
        );
      }
      if (error?.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
