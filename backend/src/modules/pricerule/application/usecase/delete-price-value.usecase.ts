import { PriceGroup } from '../../domain/enums/price-group.enum';
import { PriceValueMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Administrator xóa một giá trị hệ số không còn dùng cho lựa chọn mới;
 * suất chiếu đã tạo không bị ảnh hưởng nhờ snapshot (BR-ADM-06, BR-BRM-12).
 */
export interface DeletePriceValueUsecase {
  /**
   * Xóa vật lý một giá trị hệ số
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực group/fieldKey thuộc danh sách trường cấu hình được
   * 2. Tìm giá trị theo { ruleId, [seatType|dayType]: fieldKey }
   * 3. Xóa document theo ruleId (cho phép xóa cả giá trị cuối cùng của trường)
   * 4. Trả MSG_DELETE_SUCCESS, giá trị vừa xóa và danh sách mới của trường
   *
   * @param group - Nhóm trường (SEAT | DAY)
   * @param fieldKey - Khóa trường (VIP, COUPLE, WEEKEND, HOLIDAY)
   * @param ruleId - Id của giá trị cần xóa
   * @returns Thông điệp, giá trị vừa xóa và danh sách mới của trường
   * @throws BadRequestException khi trường không hợp lệ
   * @throws NotFoundException khi không tìm thấy giá trị trong trường
   * @throws InternalServerErrorException khi lỗi DB lúc xóa
   */
  deletePriceValue(
    group: PriceGroup,
    fieldKey: string,
    ruleId: string,
  ): Promise<PriceValueMutationResDto>;
}
