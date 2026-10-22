import { Page } from '../../../../common/dto/page.dto';
import { SearchMovieReqDto } from '../dto/req.dto';
import { MovieResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Tìm kiếm và lọc danh sách phim có phân trang
 */
export interface SearchMoviesUsecase {
  /**
   * Tìm kiếm và lọc phim
   *
   * Quy trình nghiệp vụ:
   * 1. Xây dựng điều kiện lọc (tên phim theo regex, thể loại, trạng thái, ngày phát hành)
   * 2. Truy vấn đếm tổng số bản ghi và lấy danh sách theo phân trang (page, limit)
   * 3. Chuyển đổi sang Page<MovieResDto>
   *
   * @param query - Tiêu chí tìm kiếm và phân trang
   * @returns Danh sách phim dạng phân trang Page<MovieResDto>
   */
  searchMovies(query: SearchMovieReqDto): Promise<Page<MovieResDto>>;
}
