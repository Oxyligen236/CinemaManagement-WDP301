import { SaveShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Branch Manager chỉnh sửa suất chiếu chưa bán vé của chi nhánh mình,
 * giữ các ràng buộc phòng/giờ như khi tạo.
 */
export interface UpdateManagedShowtimeUsecase {
  /**
   * Cập nhật suất chiếu.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager; tìm suất chiếu và kiểm tra phòng của suất thuộc chi nhánh
   * 2. Chặn khi suất đã có vé bán hoặc đang giữ chỗ (BR-BRM-03)
   * 3. Kiểm tra phim, phòng (BR-BRM-04), tính lại endTime (BR-BRM-02) như khi tạo
   * 4. Chỉ kiểm tra startTime ở tương lai khi startTime hoặc phòng thay đổi
   * 5. Hệ số giá: thiếu priceSelections -> giữ snapshot cũ; có mặt -> xác thực và lấy snapshot mới
   * 6. Kiểm tra chồng lấn phòng (loại trừ chính suất này, BR-BRM-01) và ghi
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param showtimeId - Mã suất chiếu cần sửa
   * @param body - Dữ liệu form đầy đủ
   * @returns Thông báo MSG02 và suất chiếu sau khi sửa
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws NotFoundException khi suất không tồn tại hoặc không thuộc chi nhánh của Manager
   * @throws ConflictException (MSG04) khi suất đã bán vé; (MSG03) khi phòng trùng lịch
   * @throws BadRequestException khi phim/phòng/giờ/hệ số không hợp lệ
   * @throws InternalServerErrorException khi lưu dữ liệu thất bại
   */
  updateShowtime(
    userId: string,
    showtimeId: string,
    body: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto>;
}
