import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cập nhật suất chiếu chưa bán vé, đảm bảo phòng không bị
 * chồng lấn thời gian.
 */
export interface UpdateShowtimeUsecase {
  /**
   * Cập nhật thông tin suất chiếu.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm suất chiếu theo mã
   * 2. Chặn khi suất chiếu đã có vé bán (BOOKED hoặc RESERVED)
   * 3. Kiểm tra chồng lấn phòng, loại trừ chính suất đang sửa
   * 4. Cập nhật phim, phòng, giờ, giá gốc và snapshot hệ số giá
   * 5. Nếu đổi phòng thì xóa trạng thái ghế cũ và sinh lại theo phòng mới
   *
   * @param showtimeId - Mã suất chiếu cần sửa
   * @param input - Dữ liệu suất chiếu mới
   * @returns Suất chiếu sau khi cập nhật
   * @throws NotFoundException khi suất chiếu không tồn tại
   * @throws ConflictException (MSG04) khi suất chiếu đã bán vé
   * @throws ConflictException (MSG03) khi phòng đã có suất chiếu chồng lấn
   * @throws InternalServerErrorException khi ghi dữ liệu thất bại
   */
  updateShowtime(
    showtimeId: string,
    input: ScheduleShowtimeInputDto,
  ): Promise<ShowtimeResDto>;
}
