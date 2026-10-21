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
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { EmploymentStatus } from '../../user/domain/enums/employment-status.enum';
import { JobPosition } from '../../user/domain/enums/job-position.enum';
import { Branch, BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../branch/domain/enums/branch-status.enum';
import {
  BRANCH_ASSIGNABLE_POSITIONS,
  CREATABLE_STATUSES,
  STAFF_MESSAGES,
  isLoginAllowed,
  resolveEmploymentStatus,
} from '../domain/staff.rules';
import {
  BranchStaffQueryDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from './dto/branch-staff.dto';

const STAFF_FIELDS =
  'userId email firstName lastName role isActive branchId jobPosition employmentStatus createdAt updatedAt';

type StaffRecord = Pick<
  User,
  'userId' | 'email' | 'firstName' | 'lastName' | 'isActive' | 'branchId'
> & {
  jobPosition?: JobPosition;
  employmentStatus?: EmploymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
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
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

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
      const conditions: Record<string, unknown>[] = [
        { branchId: branch.branchId, role: Role.STAFF },
      ];

      if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        conditions.push({
          $or: [
            { userId: regex },
            { email: regex },
            { firstName: regex },
            { lastName: regex },
          ],
        });
      }
      if (query.jobPosition) {
        conditions.push({ jobPosition: query.jobPosition });
      }
      if (query.employmentStatus) {
        conditions.push(this.statusFilter(query.employmentStatus));
      }

      const staff = await this.userModel
        .find({ $and: conditions })
        .select(STAFF_FIELDS)
        .sort({ createdAt: -1 })
        .lean<StaffRecord[]>()
        .exec();

      return {
        branch,
        staff: staff.map((record) => this.toView(record)),
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

      // AF-2 (phòng thủ thêm ngoài DTO)
      this.assertPositionAvailable(input.jobPosition);
      const status = input.employmentStatus ?? EmploymentStatus.ACTIVE;
      if (!CREATABLE_STATUSES.includes(status)) {
        throw new BadRequestException(STAFF_MESSAGES.MSG01);
      }

      const email = input.email.toLowerCase();

      // AF-3: tài khoản đã tồn tại
      const exists = await this.userModel.exists({ email }).exec();
      if (exists) {
        throw new ConflictException(STAFF_MESSAGES.ACCOUNT_EXISTS);
      }

      try {
        const created = await this.userModel.create({
          email,
          password: await bcrypt.hash(input.password, 10),
          firstName: input.firstName,
          lastName: input.lastName,
          role: Role.STAFF,
          // Bước 3: tự gán chi nhánh của Branch Manager (không nhận từ client)
          branchId: branch.branchId,
          jobPosition: input.jobPosition,
          employmentStatus: status,
          isActive: isLoginAllowed(status),
        });

        return {
          message: STAFF_MESSAGES.MSG26,
          staff: this.toView(created.toObject() as StaffRecord),
        };
      } catch (error: unknown) {
        if (this.isDuplicateKey(error)) {
          throw new ConflictException(STAFF_MESSAGES.ACCOUNT_EXISTS);
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

      const set: Record<string, unknown> = {};
      if (input.firstName !== undefined) set.firstName = input.firstName;
      if (input.lastName !== undefined) set.lastName = input.lastName;
      if (input.jobPosition !== undefined) set.jobPosition = input.jobPosition;

      let revokeSessions = false;
      if (input.employmentStatus !== undefined) {
        const previous = resolveEmploymentStatus(
          current.isActive,
          current.employmentStatus,
        );
        const loginAllowed = isLoginAllowed(input.employmentStatus);
        set.employmentStatus = input.employmentStatus;
        set.isActive = loginAllowed;
        // BR-BRM-15: chuyển sang Inactive/Resigned → thu hồi phiên đăng nhập
        revokeSessions = !loginAllowed && previous === EmploymentStatus.ACTIVE;
      }

      const updated = await this.userModel
        .findOneAndUpdate(
          { userId, branchId: branch.branchId, role: Role.STAFF },
          {
            $set: set,
            ...(revokeSessions ? { $inc: { tokenVersion: 1 } } : {}),
          },
          { new: true, runValidators: true },
        )
        .select(STAFF_FIELDS)
        .lean<StaffRecord>()
        .exec();

      if (!updated) {
        throw new NotFoundException(STAFF_MESSAGES.STAFF_NOT_FOUND);
      }

      return { message: STAFF_MESSAGES.MSG26, staff: this.toView(updated) };
    });
  }

  // ---------------------------------------------------------------------------

  /**
   * Pre-condition 2: Branch Manager chỉ quản lý nhân viên thuộc chi nhánh
   * mình. Chi nhánh lấy từ DB (không tin client) để token cũ không dùng được
   * sau khi Admin chuyển quản lý sang chi nhánh khác.
   */
  private async getManagerBranch(managerUserId: string): Promise<ManagerBranch> {
    const manager = await this.userModel
      .findOne({ userId: managerUserId })
      .select('role isActive branchId')
      .lean()
      .exec();

    if (!manager || !manager.isActive || manager.role !== Role.BRANCHMANAGER) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    if (!manager.branchId) {
      throw new ForbiddenException(STAFF_MESSAGES.NO_BRANCH);
    }

    const branch = await this.branchModel
      .findOne({ branchId: manager.branchId })
      .select('branchId branchName address branchStatus')
      .lean<ManagerBranch>()
      .exec();

    if (!branch) {
      throw new ForbiddenException(STAFF_MESSAGES.NO_BRANCH);
    }

    return {
      branchId: branch.branchId,
      branchName: branch.branchName,
      address: branch.address,
      branchStatus: branch.branchStatus,
    };
  }

  private async findBranchStaff(branchId: string, userId: string) {
    const staff = await this.userModel
      .findOne({ userId, branchId, role: Role.STAFF })
      .select(STAFF_FIELDS)
      .lean<StaffRecord>()
      .exec();
    if (!staff) {
      throw new NotFoundException(STAFF_MESSAGES.STAFF_NOT_FOUND);
    }
    return staff;
  }

  /** AF-2 / BR-BRM-14 */
  private assertPositionAvailable(position: JobPosition) {
    if (!BRANCH_ASSIGNABLE_POSITIONS.includes(position)) {
      throw new BadRequestException(STAFF_MESSAGES.MSG01);
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
          employmentStatus: { $ne: EmploymentStatus.RESIGNED },
        };
    }
  }

  private toView(record: StaffRecord) {
    return {
      userId: record.userId,
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

  private isDuplicateKey(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  /** Exception flow: DB/service không khả dụng → 503. */
  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const name =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: unknown }).name)
          : '';
      if (
        /Mongo(ose)?(Network|ServerSelection|NotConnected|Timeout)/i.test(name)
      ) {
        throw new ServiceUnavailableException(
          STAFF_MESSAGES.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}
