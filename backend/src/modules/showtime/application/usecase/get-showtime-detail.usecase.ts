import { ShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Xem chi tiết một suất chiếu
 */
export interface GetShowtimeDetailUsecase {
  /**
   * Lấy thông tin chi tiết suất chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm suất chiếu theo showtimeId
   * 2. Chuyển đổi sang ShowtimeResDto
   *
   * @param showtimeId - Mã định danh suất chiếu
   * @returns Thông tin suất chiếu
   * @throws NotFoundException khi không tồn tại suất chiếu
   */
  getShowtimeDetail(showtimeId: string): Promise<ShowtimeResDto>;
}
