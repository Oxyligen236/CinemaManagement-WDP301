import { MovieSchedulingInfoResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp thông tin phim (thời lượng, trạng thái) để module xếp lịch
 * tính giờ kết thúc và kiểm tra phim hợp lệ.
 */
export interface GetMovieSchedulingInfoUsecase {
  /**
   * Lấy thông tin xếp lịch của một phim
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm phim theo movieId
   * 2. Ánh xạ sang MovieSchedulingInfoResDto; không kiểm tra isActive/status (do caller quyết định)
   *
   * @param movieId - Mã phim
   * @returns Thông tin xếp lịch, hoặc null nếu phim không tồn tại
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getMovieSchedulingInfo(
    movieId: string,
  ): Promise<MovieSchedulingInfoResDto | null>;

  /**
   * Lấy thông tin xếp lịch của nhiều phim cùng lúc (phục vụ hiển thị danh sách)
   *
   * Quy trình nghiệp vụ:
   * 1. Nếu danh sách rỗng, trả về mảng rỗng mà không truy vấn
   * 2. Tìm các phim có movieId thuộc danh sách
   * 3. Ánh xạ sang MovieSchedulingInfoResDto (id không tồn tại sẽ vắng mặt)
   *
   * @param movieIds - Danh sách mã phim
   * @returns Danh sách thông tin xếp lịch của các phim tìm thấy
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getMovieSchedulingInfos(
    movieIds: string[],
  ): Promise<MovieSchedulingInfoResDto[]>;
}
