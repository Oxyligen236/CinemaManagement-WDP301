import { PriceGroup } from '../../domain/enums/price-group.enum';
import { UpdatePriceValueReqDto } from '../dto/req.dto';
import { PriceValueMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Administrator sửa hệ số của một giá trị đã có; suất chiếu đã tạo giữ
 * nguyên hệ số snapshot (BR-ADM-06, BR-BRM-12).
 */
export interface UpdatePriceValueUsecase {
  /**
   * Sửa multiplier của một giá trị tại chỗ (giữ nguyên ruleId)
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực group/fieldKey thuộc danh sách trường cấu hình được
   * 2. Validate multiplier (thiếu -> MSG02, sai -> AF-2) và chuẩn hóa 2 chữ số thập phân
   * 3. Tìm giá trị theo { ruleId, [seatType|dayType]: fieldKey }
   * 4. Kiểm tra trùng với giá trị khác (ruleId khác) cùng trường
   * 5. Cập nhật adjustmentValue bằng findOneAndUpdate
   * 6. Trả MSG03, giá trị sau sửa và danh sách mới của trường
   *
   * @param group - Nhóm trường (SEAT | DAY)
   * @param fieldKey - Khóa trường (VIP, COUPLE, WEEKEND, HOLIDAY)
   * @param ruleId - Id của giá trị cần sửa
   * @param dto - multiplier mới
   * @returns Thông điệp MSG03, giá trị sau sửa và danh sách mới của trường
   * @throws BadRequestException khi trường không hợp lệ hoặc multiplier thiếu/không hợp lệ
   * @throws NotFoundException khi không tìm thấy giá trị trong trường
   * @throws ConflictException khi trùng với giá trị khác cùng trường
   * @throws InternalServerErrorException khi lỗi DB lúc lưu
   */
  updatePriceValue(
    group: PriceGroup,
    fieldKey: string,
    ruleId: string,
    dto: UpdatePriceValueReqDto,
  ): Promise<PriceValueMutationResDto>;
}
