import { Page } from '../../../../common/dto/page.dto';
import { MovieOptionResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp danh sách phim có thể xếp lịch chiếu (đang hoạt động, chưa kết thúc)
 * cho dropdown tìm kiếm khi tạo/sửa suất chiếu.
 */
export interface SearchMovieOptionsUsecase {
  /**
   * Tìm kiếm phim khả dụng cho việc xếp lịch chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Dựng bộ lọc phim isActive = true và status khác ENDED
   * 2. Nếu có keyword, khớp movieName không phân biệt hoa thường (escape ký tự regex)
   * 3. Sắp xếp movieName tăng dần, phân trang
   * 4. Ánh xạ sang MovieOptionResDto và trả về Page
   *
   * @param keyword - Từ khóa tên phim (tùy chọn)
   * @param page - Số trang (bắt đầu từ 1)
   * @param limit - Số bản ghi mỗi trang
   * @returns Trang danh sách phim khả dụng
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  searchMovieOptions(
    keyword: string | undefined,
    page: number,
    limit: number,
  ): Promise<Page<MovieOptionResDto>>;
}
