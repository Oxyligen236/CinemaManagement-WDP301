import { MovieResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Vô hiệu hóa một bộ phim không còn lưu hành
 */
export interface DeactivateMovieUsecase {
  /**
   * Vô hiệu hóa phim và kiểm tra ràng buộc suất chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm phim theo movieId trong hệ thống, ném NotFoundException nếu không tồn tại
   * 2. Kiểm tra ràng buộc BR-ADM-04 qua ShowtimeModule
   * 3. Nếu có suất chiếu scheduled/ongoing -> ném ConflictException (MSG07)
   * 4. Cập nhật trạng thái isActive = false và lưu xuống database
   * 5. Trả về thông tin phim sau khi cập nhật
   *
   * @param movieId - Mã định danh phim cần vô hiệu hóa
   * @returns Thông tin chi tiết phim sau khi vô hiệu hóa
   * @throws NotFoundException khi không tìm thấy phim
   * @throws ConflictException khi phim có suất chiếu đang hoạt động (MSG07)
   */
  deactivateMovie(movieId: string): Promise<MovieResDto>;
}
