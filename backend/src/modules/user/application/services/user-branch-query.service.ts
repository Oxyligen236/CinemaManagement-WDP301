import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../domain/schemas/user.schema';
import { GetUserBranchUsecase } from '../usecase/get-user-branch.usecase';

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

@Injectable()
export class UserBranchQueryService implements GetUserBranchUsecase {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getBranchIdOfUser(userId: string): Promise<string | null> {
    const doc = (await this.userModel
      .findById(toObjectId(userId))
      .select('branchId isActive')
      .lean()
      .exec()) as unknown as {
      branchId?: Types.ObjectId | string;
      isActive: boolean;
    } | null;
    if (!doc || !doc.isActive || !doc.branchId) {
      return null;
    }
    return doc.branchId.toString();
  }
}
