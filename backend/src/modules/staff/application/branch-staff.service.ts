/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Role, EmploymentStatus, JobPosition, BranchStatus } from '@prisma/client';
import {
  BRANCH_ASSIGNABLE_POSITIONS,
  CREATABLE_STATUSES,
  STAFF_MESSAGES,
  STAFF_VALIDATION_MESSAGES,
  isLoginAllowed,
  resolveEmploymentStatus,
  staffBadRequestBody,
  staffConflictBody,
} from '../domain/staff.rules';
import {
  BranchStaffQueryDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from './dto/branch-staff.dto';

/** Mã lỗi Prisma (P2002 = trùng unique, P2025 = không tìm thấy bản ghi). */
const prismaErrorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

type ManagerBranch = {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: BranchStatus;
};

/** UC19 - Manage Branch Staff */
@Injectable()
export class BranchStaffService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thông tin chi nhánh (khóa) + danh mục vị trí/trạng thái cho form. */
  async getOptions(managerUserId: string) {
    return this.guard(async () => {
      const branch = await this.getManagerBranch(managerUserId);
      return {
        branch,
        jobPositions: BRANCH_ASSIGNABLE_POSITIONS,
        employmentStatuses: Object.values(EmploymentStatus),
        creatableStatuses: CREATABLE_STATUSES,
      };
    });
  }

  /** Main flow bước 1: danh sách nhân viên thuộc chi nhánh. */
  async listStaff(managerUserId: string, query: BranchStaffQueryDto) {
    return this.guard(async () => {
      const branch = await this.getManagerBranch(managerUserId);
      const where: any = {
        branchId: branch.branchId,
        role: Role.STAFF,
      };

      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      if (query.jobPosition) {
        where.jobPosition = query.jobPosition;
      }
      if (query.employmentStatus) {
        Object.assign(where, this.statusFilter(query.employmentStatus as EmploymentStatus));
      }

      const staff = await this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return {
        branch,
        staff: staff.map((record: any) => this.toView(record)),
        total: staff.length,
      };
    });
  }

  /** Main flow bước 2: chi tiết nhân viên đã chọn. */
  async getStaff(managerUserId: string, userId: string) {
    return this.guard(async () => {
      const branch = await this.getManagerBranch(managerUserId);
      const staff = await this.findBranchStaff(branch.branchId, userId);
      return { branch, staff: this.toView(staff) };
    });
  }

  /** Main flow bước 3-5 (tạo mới). */
  async createStaff(managerUserId: string, input: CreateBranchStaffDto) {
    return this.guard(async () => {
      const branch = await this.getManagerBranch(managerUserId);
      if (branch.branchStatus !== BranchStatus.ACTIVE) {
        throw new BadRequestException(STAFF_MESSAGES.BRANCH_NOT_ACTIVE);
      }

      this.assertPositionAvailable(input.jobPosition);
      const status = (input.employmentStatus as EmploymentStatus) ?? EmploymentStatus.ACTIVE;
      if (!CREATABLE_STATUSES.includes(status as any)) {
        throw new BadRequestException(
          staffBadRequestBody(
            'employmentStatus',
            STAFF_VALIDATION_MESSAGES.EMPLOYMENT_STATUS_NOT_CREATABLE,
          ),
        );
      }

      const email = input.email.toLowerCase();

      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) {
        throw new ConflictException(
          staffConflictBody('email', STAFF_MESSAGES.ACCOUNT_EXISTS),
        );
      }

      try {
        const created = await this.prisma.user.create({
          data: {
            email,
            password: await bcrypt.hash(input.password, 10),
            firstName: input.firstName,
            lastName: input.lastName,
            role: Role.STAFF,
            branchId: branch.branchId,
            jobPosition: input.jobPosition,
            employmentStatus: status,
            isActive: isLoginAllowed(status as any),
          },
        });

        return {
          message: STAFF_MESSAGES.MSG26,
          staff: this.toView(created),
        };
      } catch (error: unknown) {
        if (prismaErrorCode(error) === 'P2002') {
          throw new ConflictException(
            staffConflictBody('email', STAFF_MESSAGES.ACCOUNT_EXISTS),
          );
        }
        throw error;
      }
    });
  }

  /** Main flow bước 3-5 (cập nhật) + AF-4. */
  async updateStaff(
    managerUserId: string,
    userId: string,
    input: UpdateBranchStaffDto,
  ) {
    return this.guard(async () => {
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(STAFF_MESSAGES.MSG01);
      }

      const branch = await this.getManagerBranch(managerUserId);
      const current = await this.findBranchStaff(branch.branchId, userId);

      if (input.jobPosition !== undefined) {
        this.assertPositionAvailable(input.jobPosition);
      }

      const data: any = {};
      if (input.firstName !== undefined) data.firstName = input.firstName;
      if (input.lastName !== undefined) data.lastName = input.lastName;
      if (input.jobPosition !== undefined) data.jobPosition = input.jobPosition;

      let revokeSessions = false;
      if (input.employmentStatus !== undefined) {
        const previous = resolveEmploymentStatus(
          current.isActive,
          current.employmentStatus as any,
        );
        const loginAllowed = isLoginAllowed(input.employmentStatus);
        data.employmentStatus = input.employmentStatus;
        data.isActive = loginAllowed;
        revokeSessions = !loginAllowed && previous === (EmploymentStatus.ACTIVE as any);
      }
      if (revokeSessions) {
        data.tokenVersion = { increment: 1 };
      }

      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data,
        });

        return { message: STAFF_MESSAGES.MSG26, staff: this.toView(updated) };
      } catch (error: unknown) {
        // Chỉ "không tìm thấy bản ghi" (P2025) mới là 404. Bắt mọi lỗi rồi
        // đổi thành 404 che mất nguyên nhân thật (vd. DB lỗi) và báo sai cho
        // người dùng; các lỗi khác để `guard()` phân loại.
        if (prismaErrorCode(error) === 'P2025') {
          throw new NotFoundException(STAFF_MESSAGES.STAFF_NOT_FOUND);
        }
        throw error;
      }
    });
  }

  private async getManagerBranch(managerUserId: string): Promise<ManagerBranch> {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: { role: true, isActive: true, branchId: true },
    });

    if (!manager || !manager.isActive || manager.role !== Role.MANAGER) {
      throw new ForbiddenException(STAFF_MESSAGES.FORBIDDEN);
    }
    if (!manager.branchId) {
      throw new ForbiddenException(STAFF_MESSAGES.NO_BRANCH);
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: manager.branchId },
      select: { id: true, branchName: true, address: true, branchStatus: true },
    });

    if (!branch) {
      throw new ForbiddenException(STAFF_MESSAGES.NO_BRANCH);
    }

    return {
      branchId: branch.id,
      branchName: branch.branchName,
      address: branch.address,
      branchStatus: branch.branchStatus,
    };
  }

  private async findBranchStaff(branchId: string, userId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id: userId, branchId, role: Role.STAFF },
    });
    if (!staff) {
      throw new NotFoundException(STAFF_MESSAGES.STAFF_NOT_FOUND);
    }
    return staff;
  }

  private assertPositionAvailable(position: JobPosition) {
    if (!BRANCH_ASSIGNABLE_POSITIONS.includes(position as any)) {
      throw new BadRequestException(
        staffBadRequestBody(
          'jobPosition',
          STAFF_VALIDATION_MESSAGES.JOB_POSITION_INVALID,
        ),
      );
    }
  }

  private statusFilter(status: EmploymentStatus): Record<string, unknown> {
    switch (status) {
      case EmploymentStatus.ACTIVE:
        return { isActive: true };
      case EmploymentStatus.RESIGNED:
        return { isActive: false, employmentStatus: EmploymentStatus.RESIGNED };
      default:
        return {
          isActive: false,
          employmentStatus: { not: EmploymentStatus.RESIGNED },
        };
    }
  }

  private toView(record: any) {
    return {
      userId: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      branchId: record.branchId,
      jobPosition: record.jobPosition ?? null,
      employmentStatus: resolveEmploymentStatus(
        record.isActive,
        record.employmentStatus,
      ),
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(STAFF_MESSAGES.SERVICE_UNAVAILABLE);
    }
  }
}
