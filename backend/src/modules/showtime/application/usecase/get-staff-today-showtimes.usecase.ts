import { StaffShowtimeItemResDto } from '../dto/res.dto';

/**
 * Truy vấn suất chiếu hôm nay thuộc chi nhánh được phân công cho nhân viên.
 */
export interface GetStaffTodayShowtimesUsecase {
  /**
   * Lấy suất chiếu hôm nay cho nhân viên.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực nhân viên và lấy chi nhánh hoạt động được gán.
   * 2. Lọc phòng khả dụng, suất chiếu trong ngày, phim và số ghế.
   *
   * @param staffUserId - ID tài khoản nhân viên đăng nhập
   * @returns Suất chiếu chỉ thuộc chi nhánh được gán
   * @throws ForbiddenException khi nhân viên không có chi nhánh hoạt động
   */
  getStaffTodayShowtimes(
    staffUserId: string,
  ): Promise<StaffShowtimeItemResDto[]>;
}
