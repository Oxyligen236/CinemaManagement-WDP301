import { Page } from '../../../../common/dto/page.dto';
import { SearchManagedShowtimeReqDto } from '../dto/req.dto';
import { ManagedShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho Branch Manager xem danh sách và chi tiết suất chiếu
 * thuộc các phòng của chi nhánh mình (không thấy dữ liệu chi nhánh khác).
 */
export interface ListManagedShowtimesUsecase {
  /**
   * Liệt kê suất chiếu của chi nhánh Manager theo bộ lọc, có phân trang.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager theo userId
   * 2. Lấy danh sách phòng của chi nhánh; roomId lọc không thuộc chi nhánh thì trả trang rỗng
   * 3. Xác định khoảng thời gian: có date -> [00:00, 24:00) giờ rạp; không date và không includePast -> từ 00:00 hôm nay (giờ rạp)
   * 4. Truy vấn suất chiếu theo các phòng, ghép tên phim/phòng và cờ đã bán vé
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param query - Bộ lọc (date, movieId, roomId, includePast) và phân trang
   * @returns Trang suất chiếu kèm thông tin hiển thị
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws InternalServerErrorException khi không tải được dữ liệu
   */
  listShowtimes(
    userId: string,
    query: SearchManagedShowtimeReqDto,
  ): Promise<Page<ManagedShowtimeResDto>>;

  /**
   * Lấy chi tiết một suất chiếu để nạp form sửa.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager theo userId
   * 2. Tìm suất chiếu và kiểm tra phòng của suất thuộc chi nhánh Manager
   * 3. Ghép tên phim/phòng và cờ đã bán vé
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param showtimeId - Mã suất chiếu
   * @returns Chi tiết suất chiếu
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws NotFoundException khi suất không tồn tại hoặc không thuộc chi nhánh của Manager
   * @throws InternalServerErrorException khi không tải được dữ liệu
   */
  getShowtime(
    userId: string,
    showtimeId: string,
  ): Promise<ManagedShowtimeResDto>;
}
