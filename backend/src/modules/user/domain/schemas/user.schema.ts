import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  })
  userId!: string;

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
   * Chưa có Branch model trong source hiện tại nên lưu ID dạng string.
   */
  @Prop({
    trim: true,
  })
  branchId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ branchId: 1 });
UserSchema.index({ role: 1, isActive: 1 });
