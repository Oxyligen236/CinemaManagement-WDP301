/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { AuthUser } from '../../auth/domain/auth-user';
import { Branch, BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../branch/domain/enums/branch-status.enum';
import {
  CreateUserDto,
  AssignBranchDto,
  ManageUsersQueryDto,
  UpdateUserDto,
} from './dto/manage-user.dto';
import { REGISTRATION_MESSAGES } from '../../user/domain/constants/auth-message.constants';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  /**
   * Tìm chi nhánh ACTIVE theo id mà frontend gửi lên.
   *
   * Dữ liệu `branches` tồn tại 2 thế hệ: bản cũ lưu `branchId` là UUID/hex
   * dạng string, bản sau khi migrate sang ObjectId thì `branchId` lại được ghi
   * đúng BSON ObjectId. Query `{ branchId: '<hex string>' }` không khớp được
   * document thế hệ sau vì Mongoose giữ nguyên kiểu string khi so sánh, nên
   * phải dò thêm theo `_id` (giá trị `branchId` luôn trùng `_id`).
   */
  private async findActiveBranch(branchId: string) {
    const filter = isValidObjectId(branchId)
      ? { $or: [{ _id: branchId }, { branchId }] }
      : { branchId };

    return this.branchModel
      .findOne({ ...filter, branchStatus: BranchStatus.ACTIVE })
      .select('branchId')
      .lean()
      .exec();
  }

  async getDashboard(authUser: AuthUser) {
    // Kiểm tra lại trong DB: token cũ vẫn còn hạn nhưng tài khoản
    // đã bị khóa / bị hạ quyền thì không được vào nữa.
    const admin = await this.userModel.findOne({ userId: authUser.sub }).exec();

    if (!admin || !admin.isActive || admin.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const [totalUsers, activeUsers, roleCounts] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ isActive: true }).exec(),
      this.userModel
        .aggregate<{ _id: Role; count: number }>([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const usersByRole = Object.fromEntries(
      Object.values(Role).map((role) => [role, 0]),
    ) as Record<Role, number>;
    for (const { _id, count } of roleCounts) {
      usersByRole[_id] = count;
    }

    return {
      message: `Welcome back, ${admin.firstName} ${admin.lastName}`,
      admin: {
        userId: admin.userId,
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
    const filter: Record<string, unknown> = {};

    if (query.search) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      filter.$or = [
        { userId: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    if (query.role) {
      filter.role = query.role;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const users = await this.userModel
      .find(filter)
      .select(
        'userId email firstName lastName role isActive branchId createdAt updatedAt',
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return { users, total: users.length };
  }

  async getUser(userId: string) {
    const user = await this.userModel
      .findOne({ userId })
      .select(
        'userId email firstName lastName role isActive branchId createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  async getActiveBranches() {
      const branches = await this.branchModel
        .find({ branchStatus: BranchStatus.ACTIVE })
        .select('branchId branchName address branchStatus')
        .sort({ branchName: 1 })
        .lean()
        .exec();

      return { branches };
    }

  async assignBranch(
    userId: string,
    input: AssignBranchDto,
    adminUserId: string,
  ) {
      if (userId === adminUserId) {
        throw new ForbiddenException(
          'Không thể tự gán chi nhánh cho tài khoản của chính bạn.',
        );
      }

      const user = await this.userModel
        .findOne({ userId })
        .select('userId firstName lastName role isActive branchId')
        .exec();

      if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
      if (!user.isActive) {
        throw new BadRequestException(
          'Không thể gán chi nhánh cho tài khoản đã bị vô hiệu hóa.',
        );
      }
      if (user.role !== Role.BRANCHMANAGER && user.role !== Role.STAFF) {
        throw new BadRequestException(
          'Chỉ tài khoản Quản lý Chi nhánh hoặc Nhân viên mới được gán chi nhánh.',
        );
      }

      const branch = await this.findActiveBranch(input.branchId);

      if (!branch) {
        throw new BadRequestException(
          'Chi nhánh được chọn không tồn tại hoặc đang không hoạt động.',
        );
      }

      const updatedUser = await this.userModel
        .findOneAndUpdate(
          { userId },
          { $set: { branchId: input.branchId }, $inc: { tokenVersion: 1 } },
          { returnDocument: 'after', runValidators: true },
        )
        .select(
          'userId email firstName lastName role isActive branchId createdAt updatedAt',
        )
        .lean()
        .exec();

      if (!updatedUser)
        throw new NotFoundException('Không tìm thấy người dùng.');
      return {
        message: 'Cập nhật chi nhánh thành công.',
        user: updatedUser,
      };
  }

  async createUser(input: CreateUserDto) {
    const email = input.email.toLowerCase();
    if (input.branchId) {
      if (
        input.isActive === false ||
        (input.role !== Role.BRANCHMANAGER && input.role !== Role.STAFF)
      ) {
        throw new BadRequestException(
          'Chỉ tài khoản Quản lý Chi nhánh hoặc Nhân viên mới được gán chi nhánh.',
        );
      }
      const branch = await this.findActiveBranch(input.branchId);
      if (!branch) {
        throw new BadRequestException(
          'Chi nhánh được chọn không tồn tại hoặc đang không hoạt động.',
        );
      }
    }
    try {
        const user = await this.userModel.create({
          email,
          password: await bcrypt.hash(input.password, 10),
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role ?? Role.USER,
          isActive: input.isActive ?? true,
          branchId: input.branchId || undefined,
        });

        return {
          message: 'User created successfully',
          user: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            branchId: user.branchId,
          },
        };
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000
        ) {
          throw new ConflictException(
            REGISTRATION_MESSAGES.EMAIL_ALREADY_REGISTERED,
          );
        }
        throw error;
      }
  }

  async updateUser(userId: string, input: UpdateUserDto, adminUserId: string) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'Cần cung cấp ít nhất một thông tin để cập nhật.',
      );
    }

    if (userId === adminUserId) {
      const self = await this.userModel
        .findOne({ userId })
        .select('role')
        .lean()
        .exec();

      if (!self) {
        throw new NotFoundException('Không tìm thấy người dùng.');
      }

      if (input.role !== undefined && input.role !== self.role) {
        throw new ForbiddenException(
          'Không thể tự thay đổi vai trò của chính bạn.',
        );
      }

      if (input.isActive === false) {
        throw new ForbiddenException(
          'Không thể tự vô hiệu hóa tài khoản của chính bạn.',
        );
      }
    }

    if (input.email) {
      input.email = input.email.toLowerCase();
    }

    // Chỉ Branch Manager và Staff được gán chi nhánh, nên khi hạ vai trò
    // xuống USER (hoặc nâng lên ADMIN) thì branchId cũ phải được xoá, tránh
    // để lại liên kết chi nhánh trên tài khoản không còn làm việc ở đó.
    const clearBranch =
      input.role !== undefined &&
      input.role !== Role.BRANCHMANAGER &&
      input.role !== Role.STAFF;

    try {
      const user = await this.userModel
        .findOneAndUpdate(
          { userId },
          {
            $set: input,
            ...(clearBranch ? { $unset: { branchId: '' } } : {}),
            ...(input.isActive === false
              ? { $inc: { tokenVersion: 1 } }
              : {}),
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .select(
          'userId email firstName lastName role isActive branchId createdAt updatedAt',
        )
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng.');
      }

      return { message: 'Cập nhật người dùng thành công.', user };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException(
          REGISTRATION_MESSAGES.EMAIL_ALREADY_REGISTERED,
        );
      }
      throw error;
    }
  }
}
