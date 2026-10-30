import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Role } from '../enums/role.enum';
import { JobPosition } from '../enums/job-position.enum';
import { EmploymentStatus } from '../enums/employment-status.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
  timestamps: true,
})
export class User {
  _id!: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
  })
  email!: string;

  /**
   * ERD gọi là password.
   * Giá trị lưu trong database phải là password hash,
   * không được lưu mật khẩu dạng plaintext.
   */
  @Prop({
    required: true,
    select: false,
  })
  password!: string;

  @Prop({
    required: true,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    required: true,
    default: 0,
  })
  tokenVersion!: number;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  firstName!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  lastName!: string;

  @Prop({
    type: String,
    enum: Role,
    default: Role.USER,
    required: true,
  })
  role!: Role;

  /**
   * Quan hệ User - Branch.
   * ERD thể hiện nhiều User thuộc một Branch.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: false,
  })
  branchId?: Types.ObjectId;

  /**
   * Vị trí công việc - chỉ áp dụng cho tài khoản STAFF (UC19 / BR-BRM-14).
   */
  @Prop({
    type: String,
    enum: JobPosition,
  })
  jobPosition?: JobPosition;

  /**
   * Trạng thái làm việc - chỉ áp dụng cho tài khoản STAFF (UC19 / BR-BRM-15).
   * isActive vẫn là nguồn quyết định quyền đăng nhập; trường này phân biệt
   * "tạm ngưng" (INACTIVE) với "đã nghỉ việc" (RESIGNED).
   */
  @Prop({
    type: String,
    enum: EmploymentStatus,
  })
  employmentStatus?: EmploymentStatus;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ branchId: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ branchId: 1, role: 1, isActive: 1 });
