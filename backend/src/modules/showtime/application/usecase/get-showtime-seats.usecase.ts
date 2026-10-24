import { SeatShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Xem sơ đồ ghế và trạng thái ghế của một suất chiếu
 */
export interface GetShowtimeSeatsUsecase {
  /**
   * Lấy danh sách ghế (seat showtime) của một suất chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra suất chiếu tồn tại
   * 2. Lấy toàn bộ SeatShowtime theo showtimeId
   * 3. Lấy thông tin ghế vật lý (hàng, cột, loại ghế) và ghép vào kết quả
   * 4. Sắp xếp theo hàng, cột
   *
   * @param showtimeId - Mã định danh suất chiếu
   * @returns Danh sách ghế kèm trạng thái theo suất chiếu
   * @throws NotFoundException khi không tồn tại suất chiếu
   */
  getShowtimeSeats(showtimeId: string): Promise<SeatShowtimeResDto[]>;
}
