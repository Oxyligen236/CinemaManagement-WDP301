import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Tạo suất chiếu mới trong một phòng chiếu, đảm bảo phòng
 * không bị chồng lấn thời gian và sinh sẵn trạng thái ghế cho suất chiếu.
 */
export interface CreateShowtimeUsecase {
  /**
   * Tạo suất chiếu và sinh trạng thái ghế EMPTY cho mọi ghế khả dụng của phòng.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra endTime lớn hơn startTime
   * 2. Kiểm tra phòng không có suất chiếu chồng lấn khoảng [startTime, endTime)
   * 3. Ghi suất chiếu cùng snapshot hệ số giá
   * 4. Sinh SeatShowtime EMPTY cho mỗi ghế AVAILABLE của phòng
   * 5. Nếu bước sinh ghế lỗi thì xóa dữ liệu đã ghi (bù trừ) và báo lỗi hệ thống
   *
   * @param input - Dữ liệu suất chiếu đã được kiểm tra tham chiếu và tính giờ kết thúc
   * @returns Suất chiếu vừa tạo
   * @throws ConflictException (MSG03) khi phòng đã có suất chiếu chồng lấn
   * @throws InternalServerErrorException khi ghi dữ liệu thất bại
   */
  createShowtime(input: ScheduleShowtimeInputDto): Promise<ShowtimeResDto>;
}
