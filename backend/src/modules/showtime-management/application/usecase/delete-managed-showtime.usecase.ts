import { ShowtimeMutationResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Branch Manager xóa suất chiếu chưa bán vé của chi nhánh mình.
 */
export interface DeleteManagedShowtimeUsecase {
  /**
   * Xóa suất chiếu cùng trạng thái ghế của nó.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager; tìm suất chiếu và kiểm tra phòng của suất thuộc chi nhánh
   * 2. Chặn khi suất đã có vé bán hoặc đang giữ chỗ (BR-BRM-03)
   * 3. Xóa SeatShowtime rồi xóa Showtime
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param showtimeId - Mã suất chiếu cần xóa
   * @returns Thông báo MSG02 và bản ghi suất chiếu vừa xóa
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws NotFoundException khi suất không tồn tại hoặc không thuộc chi nhánh của Manager
   * @throws ConflictException (MSG05) khi suất đã bán vé
   * @throws InternalServerErrorException khi xóa dữ liệu thất bại
   */
  deleteShowtime(
    userId: string,
    showtimeId: string,
  ): Promise<ShowtimeMutationResDto>;
}
