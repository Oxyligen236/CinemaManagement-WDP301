import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { BranchStatus } from '../../domain/enums/branch-status.enum';
import { Branch, BranchDocument } from '../../domain/schemas/branch.schema';
import { GetPublicBranchesReqDto } from '../dto/req.dto';
import { BranchSummaryResDto, PublicBranchResDto } from '../dto/res.dto';
import { GetBranchSummaryUsecase } from '../usecase/get-branch-summary.usecase';
import { GetPublicBranchesUsecase } from '../usecase/get-public-branches.usecase';

@Injectable()
export class BranchQueryService
  implements GetBranchSummaryUsecase, GetPublicBranchesUsecase
{
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getBranchSummary(
    branchId: string,
  ): Promise<BranchSummaryResDto | null> {
    if (!isValidObjectId(branchId)) {
      return null;
    }
    const doc = (await this.branchModel
      .findById(branchId)
      .select('branchName')
      .lean()
      .exec()) as (Pick<Branch, 'branchName'> & { _id: unknown }) | null;
    if (!doc) {
      return null;
    }
    return BranchSummaryResDto.from({
      branchId: String(doc._id),
      branchName: doc.branchName,
    });
  }

  async getPublicBranches(
    query?: GetPublicBranchesReqDto,
  ): Promise<PublicBranchResDto[]> {
    const filter: Record<string, unknown> = {
      branchStatus: BranchStatus.ACTIVE,
    };
    if (query?.search && query.search.trim()) {
      const escaped = query.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ branchName: regex }, { address: regex }];
    }
    const docs = await this.branchModel
      .find(filter)
      .select('branchName address hotline branchStatus')
      .sort({ branchName: 1 })
      .lean()
      .exec();

    return docs.map((d: any) =>
      PublicBranchResDto.from({
        branchId: String(d._id),
        branchName: d.branchName,
        address: d.address,
        hotline: d.hotline || '1900 2224',
        branchStatus: d.branchStatus,
      }),
    );
  }
}
