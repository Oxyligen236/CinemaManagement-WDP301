import { GenreResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Lấy danh sách thể loại phim để hiển thị dropdown lựa chọn
 */
export interface GetGenresUsecase {
  /**
   * Lấy toàn bộ danh sách thể loại phim
   *
   * Quy trình nghiệp vụ:
   * 1. Truy vấn toàn bộ thể loại, sắp xếp theo tên
   * 2. Chuyển đổi sang GenreResDto
   *
   * @returns Danh sách thể loại phim
   */
  getGenres(): Promise<GenreResDto[]>;
}
