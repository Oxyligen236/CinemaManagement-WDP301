/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

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
    const admin = await this.userModel.findById(toObjectId(authUser.sub)).exec();

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
        userId: admin._id.toString(),
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
      const orConditions: Record<string, unknown>[] = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
      if (Types.ObjectId.isValid(query.search)) {
        orConditions.push({ _id: new Types.ObjectId(query.search) });
      }
      filter.$or = orConditions;
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
        '_id email firstName lastName role isActive branchId createdAt updatedAt',
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const mappedUsers = users.map((u) => ({
      userId: u._id.toString(),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      branchId: u.branchId?.toString(),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return { users: mappedUsers, total: mappedUsers.length };
  }

  async getUser(userId: string) {
    const user = await this.userModel
      .findById(toObjectId(userId))
      .select(
        '_id email firstName lastName role isActive branchId createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        branchId: user.branchId?.toString(),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async getActiveBranches() {
    const branches = await this.branchModel
      .find({ branchStatus: BranchStatus.ACTIVE })
      .select('_id branchName address branchStatus')
      .sort({ branchName: 1 })
      .lean()
      .exec();

    return {
      branches: branches.map((b) => ({
        branchId: b._id.toString(),
        branchName: b.branchName,
        address: b.address,
        branchStatus: b.branchStatus,
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

    const user = await this.userModel
      .findById(toObjectId(userId))
      .select('_id firstName lastName role isActive branchId')
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
        _id: toObjectId(input.branchId),
        branchStatus: BranchStatus.ACTIVE,
      })
      .select('_id')
      .lean()
      .exec();

    if (!branch) {
      throw new BadRequestException(
        'Selected branch is inactive and cannot be assigned.',
      );
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        toObjectId(userId),
        { $set: { branchId: toObjectId(input.branchId) }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true },
      )
      .select(
        '_id email firstName lastName role isActive branchId createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!updatedUser) throw new NotFoundException('User not found');
    return {
      message: 'Update asset(s) successfully.',
      user: {
        userId: updatedUser._id.toString(),
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        branchId: updatedUser.branchId?.toString(),
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
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
          _id: toObjectId(input.branchId),
          branchStatus: BranchStatus.ACTIVE,
        })
        .select('_id')
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
        branchId: input.branchId ? toObjectId(input.branchId) : undefined,
      });

      return {
        message: 'User created successfully',
        user: {
          userId: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          branchId: user.branchId?.toString(),
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

    if (userId === adminUserId) {
      const self = await this.userModel
        .findById(toObjectId(userId))
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

    // Chỉ Branch Manager và Staff được gán chi nhánh, nên khi hạ vai trò
    // xuống USER (hoặc nâng lên ADMIN) thì branchId cũ phải được xoá, tránh
    // để lại liên kết chi nhánh trên tài khoản không còn làm việc ở đó.
    const clearBranch =
      input.role !== undefined &&
      input.role !== Role.BRANCHMANAGER &&
      input.role !== Role.STAFF;

    const updatePayload: Record<string, unknown> = { ...input };

    try {
      const user = await this.userModel
        .findByIdAndUpdate(
          toObjectId(userId),
          {
            $set: updatePayload,
            ...(clearBranch ? { $unset: { branchId: '' } } : {}),
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
          '_id email firstName lastName role isActive branchId createdAt updatedAt',
        )
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User updated successfully',
        user: {
          userId: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          branchId: user.branchId?.toString(),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
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
}
