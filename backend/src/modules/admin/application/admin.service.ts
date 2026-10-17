import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { AuthUser } from '../../auth/domain/auth-user';
import {
  ManageUsersQueryDto,
  UpdateUserDto,
} from './dto/manage-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async getDashboard(authUser: AuthUser) {
    // Kiểm tra lại trong DB: token cũ vẫn còn hạn nhưng tài khoản
    // đã bị khóa / bị hạ quyền thì không được vào nữa.
    const admin = await this.userModel
      .findOne({ userId: authUser.sub })
      .exec();

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
      .select('userId email firstName lastName role isActive branchId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return { users, total: users.length };
  }

  async getUser(userId: string) {
    const user = await this.userModel
      .findOne({ userId })
      .select('userId email firstName lastName role isActive branchId createdAt updatedAt')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  async updateUser(userId: string, input: UpdateUserDto, adminUserId: string) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    if (
      userId === adminUserId &&
      (input.isActive === false || input.role === Role.USER)
    ) {
      throw new ForbiddenException('You cannot disable or demote your own account');
    }

    if (input.email) {
      input.email = input.email.toLowerCase();
    }

    try {
      const user = await this.userModel
        .findOneAndUpdate({ userId }, { $set: input }, {
          new: true,
          runValidators: true,
        })
        .select('userId email firstName lastName role isActive branchId createdAt updatedAt')
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
