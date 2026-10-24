import { PriceGroup } from '../../domain/enums/price-group.enum';
import { CreatePriceValueReqDto } from '../dto/req.dto';
import { PriceValueMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Administrator thêm một giá trị hệ số nhân giá vé mới cho một trường;
 * chỉ ảnh hưởng suất chiếu tạo mới và vé mua trong tương lai (BR-ADM-06, BR-BRM-12).
 */
export interface CreatePriceValueUsecase {
  /**
   * Thêm một giá trị hệ số mới vào một trường
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực group/fieldKey thuộc danh sách trường cấu hình được
   * 2. Validate multiplier (thiếu -> MSG02, sai -> AF-2) và chuẩn hóa 2 chữ số thập phân
   * 3. Đếm giá trị hiện có của trường, nếu đã đủ 20 thì từ chối
   * 4. Kiểm tra trùng multiplier trong cùng trường
   * 5. Tạo 1 document với adjustmentValue = multiplier (ruleId tự sinh UUID)
   * 6. Trả MSG_CREATE_SUCCESS, giá trị mới và danh sách mới của trường
   *
   * @param group - Nhóm trường (SEAT | DAY)
   * @param fieldKey - Khóa trường (VIP, COUPLE, WEEKEND, HOLIDAY)
   * @param dto - Giá trị multiplier cần thêm
   * @returns Thông điệp, giá trị vừa tạo và danh sách mới của trường
   * @throws BadRequestException khi trường không hợp lệ hoặc multiplier thiếu/không hợp lệ
   * @throws ConflictException khi trùng giá trị hoặc trường đã đủ 20 giá trị
   * @throws InternalServerErrorException khi lỗi DB lúc lưu
   */
  createPriceValue(
    group: PriceGroup,
    fieldKey: string,
    dto: CreatePriceValueReqDto,
  ): Promise<PriceValueMutationResDto>;
}
