import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from '../../domain/schemas/branch.schema';
import { BranchSummaryResDto } from '../dto/res.dto';
import { GetBranchSummaryUsecase } from '../usecase/get-branch-summary.usecase';

@Injectable()
export class BranchQueryService implements GetBranchSummaryUsecase {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getBranchSummary(
    branchId: string,
  ): Promise<BranchSummaryResDto | null> {
    const doc = (await this.branchModel
      .findOne({ branchId })
      .lean()
      .exec()) as unknown as Pick<Branch, 'branchId' | 'branchName'> | null;
    if (!doc) {
      return null;
    }
    return { branchId: doc.branchId, branchName: doc.branchName };
  }
}
