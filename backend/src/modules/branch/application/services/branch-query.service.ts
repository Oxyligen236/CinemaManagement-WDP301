import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BranchStatus } from '@prisma/client';
import { GetPublicBranchesReqDto } from '../dto/req.dto';
import { BranchSummaryResDto, PublicBranchResDto } from '../dto/res.dto';

@Injectable()
export class BranchQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchSummary(
    branchId: string,
  ): Promise<BranchSummaryResDto | null> {
    const doc = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, branchName: true },
    });
    if (!doc) {
      return null;
    }
    return BranchSummaryResDto.of(doc.id, doc.branchName);
  }

  async getPublicBranches(
    query?: GetPublicBranchesReqDto,
  ): Promise<PublicBranchResDto[]> {
    const where: any = {
      branchStatus: BranchStatus.ACTIVE,
    };
    if (query?.search && query.search.trim()) {
      where.OR = [
        { branchName: { contains: query.search.trim(), mode: 'insensitive' } },
        { address: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    const docs = await this.prisma.branch.findMany({
      where,
      select: {
        id: true,
        branchName: true,
        address: true,
        hotline: true,
        branchStatus: true,
      },
      orderBy: { branchName: 'asc' },
    });

    return docs.map((d) =>
      PublicBranchResDto.of(
        d.id,
        d.branchName,
        d.address,
        d.hotline || '1900 2224',
        d.branchStatus as any,
      ),
    );
  }
}
