import { Page } from '../../../../common/dto/page.dto';
import { SearchShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Xem danh sách suất chiếu có lọc và phân trang
 */
export interface SearchShowtimesUsecase {
  /**
   * Tìm kiếm và lọc suất chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Xây dựng điều kiện lọc (phim, phòng, chi nhánh, ngày chiếu, khoảng thời gian bắt đầu)
   * 2. Nếu lọc theo chi nhánh, lấy danh sách phòng của chi nhánh rồi giới hạn suất chiếu trong các phòng đó
   * 3. Đếm tổng số bản ghi và lấy danh sách theo phân trang, sắp xếp theo startTime tăng dần
   * 4. Chuyển đổi sang Page<ShowtimeResDto>
   *
   * @param query - Tiêu chí lọc và phân trang
   * @returns Danh sách suất chiếu dạng phân trang Page<ShowtimeResDto>
   */
  searchShowtimes(query: SearchShowtimeReqDto): Promise<Page<ShowtimeResDto>>;
}
