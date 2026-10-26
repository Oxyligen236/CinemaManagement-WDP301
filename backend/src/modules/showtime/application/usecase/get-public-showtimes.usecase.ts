import { GetPublicShowtimesReqDto } from '../dto/req.dto';
import { PublicShowtimeItemResDto } from '../dto/res.dto';

/**
 * Tra cứu danh sách suất chiếu công khai phục vụ khách hàng xem lịch chiếu theo rạp và ngày.
 *
 * Quy trình nghiệp vụ:
 * 1. Tiếp nhận điều kiện lọc bao gồm branchId, date (YYYY-MM-DD), movieId.
 * 2. Lấy danh sách phòng chiếu thuộc chi nhánh (nếu có lọc theo branchId).
 * 3. Truy vấn các suất chiếu trong khoảng thời gian của ngày yêu cầu thuộc các phòng chiếu tương ứng.
 * 4. Nạp thông tin chi tiết phim (tên, thời lượng, poster, thể loại) và phòng chiếu.
 * 5. Tính toán số lượng ghế trống và tổng số ghế cho mỗi suất chiếu.
 * 6. Sắp xếp danh sách suất chiếu theo thời gian bắt đầu (startTime) tăng dần và trả về kết quả.
 *
 * @param query - Bộ lọc suất chiếu công khai (branchId, date, movieId)
 * @returns Danh sách suất chiếu công khai kèm thông tin phim, phòng và ghế
 * @throws Không ném ngoại lệ nghiệp vụ (trả mảng rỗng nếu không tìm thấy dữ liệu)
 */
export interface GetPublicShowtimesUsecase {
  getPublicShowtimes(
    query: GetPublicShowtimesReqDto,
  ): Promise<PublicShowtimeItemResDto[]>;
}
