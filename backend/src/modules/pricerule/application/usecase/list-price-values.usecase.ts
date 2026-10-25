import { PriceFieldResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Administrator xem và Branch Manager chọn các giá trị hệ số nhân giá vé
 * hiện có theo từng trường (VIP, COUPLE, WEEKEND, HOLIDAY) (BR-ADM-06, BR-BRM-12).
 */
export interface ListPriceValuesUsecase {
  /**
   * Liệt kê đủ 4 trường cấu hình kèm danh sách giá trị hệ số hiện có
   *
   * Quy trình nghiệp vụ:
   * 1. Với mỗi trường trong PRICE_FIELDS, đọc document của collection tương ứng theo
   *    { [seatType|dayType]: fieldKey, adjustmentValue: { $gte: 1 } } (bỏ qua document legacy < 1),
   *    sắp xếp adjustmentValue tăng dần
   * 2. Ánh xạ adjustmentValue sang multiplier
   * 3. Gom theo thứ tự cố định của PRICE_FIELDS (trường chưa có giá trị trả values: [])
   *
   * @returns Danh sách 4 trường kèm các giá trị hệ số (multiplier tăng dần)
   * @throws InternalServerErrorException khi lỗi DB lúc đọc (Unable to load pricing configurations.)
   */
  listPriceValues(): Promise<PriceFieldResDto[]>;
}
