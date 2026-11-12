import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { UserProfileRes } from '../dto/res.dto';

@Injectable()
export class UserProfileQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<UserProfileRes> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return UserProfileRes.of(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.role,
      user.branchId,
      user.jobPosition,
      user.employmentStatus,
      user.createdAt,
      user.updatedAt,
    );
  }
}
