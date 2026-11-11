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
import {
  AdminBranchItemRes,
  AdminBranchesListRes,
  AdminDashboardRes,
  AdminDashboardStatsRes,
  AdminInfoRes,
  AdminUserDetailRes,
  AdminUserItemRes,
  AdminUserMutateRes,
  AdminUsersListRes,
} from './dto/res.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(authUser: AuthUser): Promise<AdminDashboardRes> {
    const admin = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
    });

    if (!admin || !admin.isActive || admin.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này',
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

    const adminInfo = AdminInfoRes.of(
      admin.id,
      admin.email,
      admin.firstName,
      admin.lastName,
    );
    const stats = AdminDashboardStatsRes.of(
      totalUsers,
      activeUsers,
      totalUsers - activeUsers,
      usersByRole,
    );

    return AdminDashboardRes.of(
      `Welcome back, ${admin.firstName} ${admin.lastName}`,
      adminInfo,
      stats,
    );
  }

  async getUsers(query: ManageUsersQueryDto): Promise<AdminUsersListRes> {
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

    const users = docs.map((u: any) =>
      AdminUserItemRes.of({
        userId: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        branchId: u.branchId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }),
    );

    return AdminUsersListRes.of(users, users.length);
  }

  async getUser(userId: string): Promise<AdminUserDetailRes> {
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
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    return AdminUserDetailRes.of(
      AdminUserItemRes.of({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        branchId: user.branchId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
    );
  }

  async getActiveBranches(): Promise<AdminBranchesListRes> {
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

    return AdminBranchesListRes.of(
      branches.map((b: any) =>
        AdminBranchItemRes.of(b.id, b.branchName, b.address, b.branchStatus),
      ),
    );
  }

  async assignBranch(
    userId: string,
    input: AssignBranchDto,
    adminUserId: string,
  ): Promise<AdminUserMutateRes> {
    if (userId === adminUserId) {
      throw new ForbiddenException(
        'Không thể chỉ định chi nhánh cho tài khoản của bạn',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        branchId: true,
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!user.isActive) {
      throw new BadRequestException(
        'Không thể chỉ định chi nhánh cho một tài khoản không hoạt động',
      );
    }
    if (user.role !== Role.MANAGER && user.role !== Role.STAFF) {
      throw new BadRequestException(
        'Chỉ các tài khoản Branch Manager hoặc Staff mới có thể được chỉ định cho một chi nhánh',
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
        'Chi nhánh được chọn không hoạt động và không thể được chỉ định.',
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

    return AdminUserMutateRes.of(
      'Cập nhật tài khoản thành công.',
      AdminUserItemRes.of({
        userId: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        branchId: updatedUser.branchId,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      }),
    );
  }

  async createUser(input: CreateUserDto): Promise<AdminUserMutateRes> {
    const email = input.email.toLowerCase();
    if (input.branchId) {
      if (
        input.isActive === false ||
        (input.role !== Role.MANAGER && input.role !== Role.STAFF)
      ) {
        throw new BadRequestException(
          'Chỉ các tài khoản Branch Manager hoặc Staff mới có thể được chỉ định cho một chi nhánh',
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
          'Chi nhnhánh được chọn không hoạt động và không thể được chỉ định.',
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

      return AdminUserMutateRes.of(
        'Tạo tài khoản thành công',
        AdminUserItemRes.of({
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          branchId: user.branchId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Tên người dùng phải là duy nhất trong toàn hệ thống.',
        );
      }
      throw error;
    }
  }

  async updateUser(
    userId: string,
    input: UpdateUserDto,
    adminUserId: string,
  ): Promise<AdminUserMutateRes> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'Ít nhất một trường phải được cung cấp để cập nhật',
      );
    }

    if (userId === adminUserId) {
      const self = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!self) {
        throw new NotFoundException('Không tìm thấy tài khoản của bạn');
      }

      if (
        input.role !== undefined &&
        (input.role as unknown as Role) !== self.role
      ) {
        throw new ForbiddenException(
          'Không thể thay đổi vai trò của chính bạn',
        );
      }

      if (input.isActive === false) {
        throw new ForbiddenException(
          'Không thể vô hiệu hóa tài khoản của chính bạn',
        );
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

      return AdminUserMutateRes.of(
        'Cập nhật tài khoản thành công',
        AdminUserItemRes.of({
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          branchId: user.branchId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          REGISTRATION_MESSAGES.EMAIL_ALREADY_REGISTERED,
        );
      }
      if (error?.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy tài khoản để cập nhật');
      }
      throw error;
    }
  }
}
