import { ShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Xóa suất chiếu chưa bán vé cùng toàn bộ trạng thái ghế của nó.
 */
export interface DeleteShowtimeUsecase {
  /**
   * Xóa suất chiếu và trạng thái ghế liên quan.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm suất chiếu theo mã
   * 2. Chặn khi suất chiếu đã có vé bán (BOOKED hoặc RESERVED)
   * 3. Xóa toàn bộ SeatShowtime của suất chiếu
   * 4. Xóa suất chiếu
   *
   * @param showtimeId - Mã suất chiếu cần xóa
   * @returns Suất chiếu vừa bị xóa
   * @throws NotFoundException khi suất chiếu không tồn tại
   * @throws ConflictException (MSG05) khi suất chiếu đã bán vé
   * @throws InternalServerErrorException khi xóa dữ liệu thất bại
   */
  deleteShowtime(showtimeId: string): Promise<ShowtimeResDto>;
}
