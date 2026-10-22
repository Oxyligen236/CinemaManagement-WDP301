import { CreateMovieReqDto } from '../dto/req.dto';
import { MovieResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Tạo mới một bộ phim vào hệ thống rạp chiếu
 */
export interface CreateMovieUsecase {
  /**
   * Tạo mới thông tin phim
   *
   * Quy trình nghiệp vụ:
   * 1. Validate dữ liệu đầu vào (tên, thời lượng, thể loại, ngày công chiếu, posterKey, trailerUrl)
   * 2. Nếu có posterKey, kiểm tra file poster tồn tại trên storage
   * 3. Khởi tạo bản ghi Movie với trạng thái mặc định (isActive: true), chỉ lưu posterKey và trailerUrl
   * 4. Lưu vào database và trả về thông tin phim đã tạo (posterUrl sinh từ posterKey)
   *
   * @param dto - Thông tin tạo phim mới
   * @returns Thông tin chi tiết phim đã được tạo
   * @throws BadRequestException khi dữ liệu không hợp lệ hoặc posterKey không tồn tại trên storage
   */
  createMovie(dto: CreateMovieReqDto): Promise<MovieResDto>;
}
