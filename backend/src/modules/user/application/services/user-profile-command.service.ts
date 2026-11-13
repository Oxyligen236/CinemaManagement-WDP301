import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { UpdateProfileReq } from '../dto/req.dto';
import { UserProfileRes } from '../dto/res.dto';
import { UserProfileUpdatedEvent } from '../../domain/events/user-profile-updated.event';

@Injectable()
export class UserProfileCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    userId: string,
    req: UpdateProfileReq,
  ): Promise<UserProfileRes> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const dataToUpdate: { firstName?: string; lastName?: string } = {};
    if (req.firstName !== undefined) {
      dataToUpdate.firstName = req.firstName;
    }
    if (req.lastName !== undefined) {
      dataToUpdate.lastName = req.lastName;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: { branch: true },
    });

    this.eventEmitter.emit(
      'user.profile.updated',
      new UserProfileUpdatedEvent(user.id, dataToUpdate, updatedUser.updatedAt),
    );

    return UserProfileRes.of(
      updatedUser.id,
      updatedUser.email,
      updatedUser.firstName,
      updatedUser.lastName,
      updatedUser.role,
      updatedUser.branchId,
      updatedUser.jobPosition,
      updatedUser.employmentStatus,
      updatedUser.createdAt,
      updatedUser.updatedAt,
      updatedUser.branch?.branchName,
    );
  }
}
