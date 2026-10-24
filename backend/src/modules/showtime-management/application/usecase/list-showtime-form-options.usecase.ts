import { Page } from '../../../../common/dto/page.dto';
import { MovieOptionResDto } from '../../../movie/application/dto/res.dto';
import { RoomOptionResDto } from '../../../room/application/dto/res.dto';
import { MovieOptionSearchReqDto } from '../dto/req.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp dữ liệu cho các ô chọn của form suất chiếu
 * (phim có tìm kiếm, phòng của chi nhánh).
 */
export interface ListShowtimeFormOptionsUsecase {
  /**
   * Tìm phim để xếp lịch (dropdown có tìm kiếm).
   *
   * Quy trình nghiệp vụ:
   * 1. Xác nhận Manager đã được gán chi nhánh
   * 2. Tìm phim đang hoạt động và chưa kết thúc chiếu theo từ khóa, phân trang
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @param query - Từ khóa và phân trang
   * @returns Trang phim khả dụng
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws InternalServerErrorException khi không tải được dữ liệu
   */
  searchMovieOptions(
    userId: string,
    query: MovieOptionSearchReqDto,
  ): Promise<Page<MovieOptionResDto>>;

  /**
   * Liệt kê phòng của chi nhánh Manager (kèm trạng thái để FE vô hiệu hóa phòng không hoạt động).
   *
   * Quy trình nghiệp vụ:
   * 1. Tra chi nhánh của Manager theo userId
   * 2. Lấy mọi phòng của chi nhánh
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @returns Danh sách phòng của chi nhánh
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh
   * @throws InternalServerErrorException khi không tải được dữ liệu
   */
  listRoomOptions(userId: string): Promise<RoomOptionResDto[]>;
}
