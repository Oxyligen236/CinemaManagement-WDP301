import { SaveShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Branch Manager tạo suất chiếu mới cho phòng thuộc chi nhánh mình,
 * hệ thống tự tính giờ kết thúc và chặn phòng trùng lịch.
 */
export interface CreateManagedShowtimeUsecase {
  /**
   * Tạo suất chiếu mới.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager theo userId
   * 2. Kiểm tra phim tồn tại, đang hoạt động và chưa kết thúc chiếu
   * 3. Kiểm tra phòng thuộc chi nhánh và đang ở trạng thái AVAILABLE (BR-BRM-04)
   * 4. Tính startTime từ ngày + giờ (giờ rạp UTC+7) và endTime = startTime + thời lượng phim (BR-BRM-02); startTime phải ở tương lai
   * 5. Xác thực lựa chọn hệ số giá và lấy snapshot (thiếu -> mọi hệ số 1.0)
   * 6. Kiểm tra phòng không chồng lấn thời gian (BR-BRM-01) và ghi suất chiếu cùng ghế
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param body - Dữ liệu form (phim, ngày chiếu, giờ bắt đầu, phòng, hệ số giá)
   * @returns Thông báo MSG02 và suất chiếu vừa tạo
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws BadRequestException khi phim/phòng/giờ/hệ số không hợp lệ
   * @throws ConflictException (MSG03) khi phòng đã có suất chiếu chồng lấn
   * @throws InternalServerErrorException khi lưu dữ liệu thất bại
   */
  createShowtime(
    userId: string,
    body: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto>;
}
