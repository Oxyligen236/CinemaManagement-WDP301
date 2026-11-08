import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ValidationError,
} from '@nestjs/common';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../auth/domain/auth-user';
import { Role } from '../../user/domain/enums/role.enum';
import { BranchStaffService } from '../application/branch-staff.service';
import {
  BranchStaffQueryDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from '../application/dto/branch-staff.dto';
import { STAFF_MESSAGES } from '../domain/staff.rules';

/**
 * Thứ tự ưu tiên khi một trường vi phạm nhiều ràng buộc cùng lúc.
 *
 * `error.constraints` của class-validator không theo thứ tự khai báo decorator,
 * nên nếu lấy bừa một message thì ô email bỏ trống có thể nhận câu "Email
 * không đúng định dạng" thay vì "Vui lòng nhập email". Báo thiếu dữ liệu trước,
 * rồi tới sai độ dài, cuối cùng mới tới sai định dạng / ngoài danh mục.
 */
const CONSTRAINT_PRIORITY = [
  ['isNotEmpty', 'isDefined', 'isString'],
  ['maxLength', 'minLength', 'length'],
];

const pickMessage = (
  constraints: Record<string, string>,
): string | undefined => {
  for (const group of CONSTRAINT_PRIORITY) {
    const key = group.find((name) => constraints[name]);
    if (key) return constraints[key];
  }
  return Object.values(constraints)[0];
};

/**
 * Gom lỗi validate thành map `đường dẫn trường -> thông báo`.
 *
 * Mỗi trường chỉ giữ MỘT thông báo vì giao diện hiển thị một dòng lỗi dưới mỗi
 * ô nhập. Đệ quy xuống `children` để DTO lồng nhau cũng có đường dẫn đầy đủ
 * (vd. `profile.firstName`) chứ không mất tên trường.
 */
const collectFieldErrors = (
  errors: ValidationError[],
  parent = '',
  target: Record<string, string> = {},
): Record<string, string> => {
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const message = pickMessage(error.constraints ?? {});
    if (message && !target[path]) {
      target[path] = message;
    }
    collectFieldErrors(error.children ?? [], path, target);
  }
  return target;
};

/**
 * AF-1 / AF-2: lỗi validate trả về thông báo của đúng trường bị sai qua
 * `fieldErrors` để giao diện gắn câu lỗi vào đúng ô nhập. `message` lấy luôn
 * câu của trường đầu tiên khi chỉ sai một trường, để nơi nào chỉ hiển thị
 * banner chung cũng nêu được lý do cụ thể thay vì MSG01 chung chung.
 */
export const staffValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) => {
    const fieldErrors = collectFieldErrors(errors);
    const messages = Object.values(fieldErrors);
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: messages.length === 1 ? messages[0] : STAFF_MESSAGES.MSG01,
      errors: messages,
      fields: Object.keys(fieldErrors),
      fieldErrors,
    });
  },
});

/** UC19 - Manage Branch Staff */
@Controller('manager/staff')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
@UsePipes(staffValidationPipe)
export class BranchStaffController {
  constructor(private readonly branchStaffService: BranchStaffService) {}

  @Get('options')
  getOptions(@Req() req: AuthenticatedRequest) {
    return this.branchStaffService.getOptions((req.user as AuthUser).sub);
  }

  @Get()
  listStaff(
    @Req() req: AuthenticatedRequest,
    @Query() query: BranchStaffQueryDto,
  ) {
    return this.branchStaffService.listStaff((req.user as AuthUser).sub, query);
  }

  @Get(':userId')
  getStaff(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.branchStaffService.getStaff((req.user as AuthUser).sub, userId);
  }

  @Post()
  createStaff(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateBranchStaffDto,
  ) {
    return this.branchStaffService.createStaff(
      (req.user as AuthUser).sub,
      input,
    );
  }

  @Patch(':userId')
  updateStaff(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() input: UpdateBranchStaffDto,
  ) {
    return this.branchStaffService.updateStaff(
      (req.user as AuthUser).sub,
      userId,
      input,
    );
  }
}
