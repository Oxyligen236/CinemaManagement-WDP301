import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../domain/schemas/user.schema';
import { AUTH_MESSAGES } from '../../domain/constants/auth-message.constants';

@Injectable()
export class UserAuthenticationService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+password')
      .exec();

    // Sai email hoặc sai mật khẩu đều trả về cùng một lỗi để không tiết lộ
    // email nào đang tồn tại trong hệ thống.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    // Đúng mật khẩu nhưng tài khoản bị vô hiệu hóa: thông báo riêng, vì người
    // dùng có nhập lại bao nhiêu lần cũng không đăng nhập được.
    if (!user.isActive) {
      throw new UnauthorizedException(AUTH_MESSAGES.ACCOUNT_DISABLED);
    }

    const userIdStr = (user._id ?? (user as any).userId)?.toString();
    const branchIdStr = user.branchId?.toString();

    const payload = {
      sub: userIdStr,
      email: user.email,
      role: user.role,
      branchId: branchIdStr,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        userId: userIdStr,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: branchIdStr,
      },
    };
  }
}
