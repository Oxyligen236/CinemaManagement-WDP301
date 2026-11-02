import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ChangePasswordUsecase } from '../usecase/change-password.usecase';
import { ChangePasswordReq } from '../dto/req.dto';
import { UserPasswordChangedEvent } from '../../domain/events/user-password-changed.event';

@Injectable()
export class ChangePasswordService implements ChangePasswordUsecase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    userId: string,
    req: ChangePasswordReq,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      req.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    if (req.currentPassword === req.newPassword) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng mật khẩu cũ',
      );
    }

    const hashedPassword = await bcrypt.hash(req.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    this.eventEmitter.emit(
      'user.password.changed',
      new UserPasswordChangedEvent(user.id, new Date()),
    );

    return {
      message:
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
    };
  }
}
