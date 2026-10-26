import { MovieDetailResDto } from '../dto/res.dto';

/**
 * Lấy chi tiết thông tin phim và danh sách thể loại tương ứng để hiển thị công khai.
 */
export interface GetMovieDetailUsecase {
  /**
   * Tra cứu chi tiết một phim theo mã định danh duy nhất (movieId).
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm bản ghi phim theo movieId và isActive = true trong bảng movies.
   * 2. Nếu không tìm thấy, ném ngoại lệ NotFoundException (404).
   * 3. Lấy danh sách thể loại từ genreIds thông qua bảng genres.
   * 4. Tạo URL công khai cho poster từ posterKey.
   * 5. Trả về đối tượng MovieDetailResDto hoàn chỉnh.
   *
   * @param movieId - Mã định danh duy nhất của phim
   * @returns Đối tượng thông tin chi tiết phim kèm danh sách thể loại
   * @throws NotFoundException khi không tìm thấy phim hoặc phim đã bị vô hiệu hóa
   */
  getMovieDetail(movieId: string): Promise<MovieDetailResDto>;
}
