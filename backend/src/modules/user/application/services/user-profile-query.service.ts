import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { GetProfileUsecase } from '../usecase/get-profile.usecase';
import { UserProfileRes } from '../dto/res.dto';

@Injectable()
export class UserProfileQueryService implements GetProfileUsecase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<UserProfileRes> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return UserProfileRes.fromEntity(user);
  }
}
