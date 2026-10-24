import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../domain/schemas/user.schema';
import { GetUserBranchUsecase } from '../usecase/get-user-branch.usecase';

@Injectable()
export class UserBranchQueryService implements GetUserBranchUsecase {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getBranchIdOfUser(userId: string): Promise<string | null> {
    const doc = (await this.userModel
      .findOne({ userId })
      .select('branchId isActive')
      .lean()
      .exec()) as unknown as Pick<User, 'branchId' | 'isActive'> | null;
    if (!doc || !doc.isActive || !doc.branchId) {
      return null;
    }
    return doc.branchId;
  }
}
