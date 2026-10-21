/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

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
      // Admin không được tự gán chi nhánh cho chính mình: tài khoản quản trị
      // là cấp toàn hệ thống, không thuộc về bất kỳ chi nhánh nào.
      if (userId === adminUserId) {
        throw new ForbiddenException(
          'You cannot assign a branch to your own account',
        );
      }

      const user = await this.userModel
        .findOne({ userId })
        .select('userId firstName lastName role isActive branchId')
        .exec();

      if (!user) throw new NotFoundException('User not found');
      if (!user.isActive) {
        throw new BadRequestException(
          'Cannot assign branch to an inactive account',
        );
      }
      if (user.role !== Role.BRANCHMANAGER && user.role !== Role.STAFF) {
        throw new BadRequestException(
          'Only Branch Manager or Staff accounts can be assigned to a branch',
        );
      }

      const branch = await this.branchModel
        .findOne({
          branchId: input.branchId,
          branchStatus: BranchStatus.ACTIVE,
        })
        .select('branchId')
        .lean()
        .exec();

      if (!branch) {
        throw new BadRequestException(
          'Selected branch is inactive and cannot be assigned.',
        );
      }

      const updatedUser = await this.userModel
        .findOneAndUpdate(
          { userId },
          { $set: { branchId: input.branchId }, $inc: { tokenVersion: 1 } },
          { new: true, runValidators: true },
        )
        .select(
          'userId email firstName lastName role isActive branchId createdAt updatedAt',
        )
        .lean()
        .exec();

      if (!updatedUser) throw new NotFoundException('User not found');
      return {
        message: 'Update asset(s) successfully.',
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
          'Only Branch Manager or Staff accounts can be assigned to a branch',
        );
      }
      const branch = await this.branchModel
        .findOne({
          branchId: input.branchId,
          branchStatus: BranchStatus.ACTIVE,
        })
        .select('branchId')
        .lean()
        .exec();
      if (!branch) {
        throw new BadRequestException(
          'Selected branch is inactive and cannot be assigned.',
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

    // Tự bảo vệ tài khoản quản trị đang đăng nhập: không được tự đổi vai trò
    // (tránh tự khóa quyền quản trị) và không được tự vô hiệu hóa.
    if (userId === adminUserId) {
      const self = await this.userModel
        .findOne({ userId })
        .select('role')
        .lean()
        .exec();

      if (!self) {
        throw new NotFoundException('User not found');
      }

      if (input.role !== undefined && input.role !== self.role) {
        throw new ForbiddenException('You cannot change your own role');
      }

      if (input.isActive === false) {
        throw new ForbiddenException('You cannot disable your own account');
      }
    }

    if (input.email) {
      input.email = input.email.toLowerCase();
    }

    try {
      const user = await this.userModel
        .findOneAndUpdate(
          { userId },
          {
            $set: input,
            ...(input.isActive === false
              ? { $inc: { tokenVersion: 1 } }
              : {}),
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .select(
          'userId email firstName lastName role isActive branchId createdAt updatedAt',
        )
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return { message: 'User updated successfully', user };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
