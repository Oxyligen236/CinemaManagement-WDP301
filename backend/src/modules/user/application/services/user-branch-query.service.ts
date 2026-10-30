import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { GetUserBranchUsecase } from '../usecase/get-user-branch.usecase';

@Injectable()
export class UserBranchQueryService implements GetUserBranchUsecase {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchIdOfUser(userId: string): Promise<string | null> {
    const doc = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true, isActive: true },
    });
    if (!doc || !doc.isActive || !doc.branchId) {
      return null;
    }
    return doc.branchId;
  }
}
