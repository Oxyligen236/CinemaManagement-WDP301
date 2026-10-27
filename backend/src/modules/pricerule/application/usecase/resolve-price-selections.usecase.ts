import { PriceSelectionInputDto } from '../dto/req.dto';
import { ResolvedPriceSelectionsResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho UC Manage Showtimes xác thực lựa chọn hệ số của Branch Manager và nhận
 * snapshot hệ số để lưu vào suất chiếu, giúp giá lịch sử không đổi khi cấu hình thay đổi (BR-BRM-12).
 */
export interface ResolvePriceSelectionsUsecase {
  /**
   * Xác thực lựa chọn và trả snapshot hệ số cho đủ 4 trường
   *
   * Quy trình nghiệp vụ:
   * 1. Với mỗi trường trong PRICE_FIELDS, tìm lựa chọn tương ứng trong selections
   *    (trường lặp lại trong selections bị từ chối)
   * 2. Nếu có lựa chọn: tìm theo { ruleId, [seatType|dayType]: fieldKey, adjustmentValue: { $gte: 1 } },
   *    không thấy thì từ chối
   * 3. Nếu không có lựa chọn: ruleId = null, multiplier = 1.0
   * 4. Trả 2 mảng snapshot seatPriceSelections và dayPriceSelections đủ 4 trường
   *
   * @param selections - Các lựa chọn (group, fieldKey, ruleId) của Branch Manager
   * @returns Snapshot hệ số cho nhóm ghế và nhóm ngày
   * @throws BadRequestException khi ruleId không tồn tại, đã bị xóa, không thuộc đúng trường hoặc trường bị lặp
   */
  resolvePriceSelections(
    selections: PriceSelectionInputDto[],
  ): Promise<ResolvedPriceSelectionsResDto>;
}
