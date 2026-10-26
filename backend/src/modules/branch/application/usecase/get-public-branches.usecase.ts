import { GetPublicBranchesReqDto } from '../dto/req.dto';
import { PublicBranchResDto } from '../dto/res.dto';

/**
 * Lấy danh sách các chi nhánh rạp đang hoạt động phục vụ khách hàng tra cứu lịch chiếu.
 *
 * Quy trình nghiệp vụ:
 * 1. Tiếp nhận điều kiện tìm kiếm tùy chọn (từ khóa search).
 * 2. Truy vấn trực tiếp database lấy các chi nhánh có trạng thái ACTIVE.
 * 3. Sắp xếp danh sách chi nhánh theo tên tăng dần A-Z.
 * 4. Chuyển đổi dữ liệu sang định dạng PublicBranchResDto.
 *
 * @param query - Bộ lọc tìm kiếm chi nhánh (nếu có)
 * @returns Danh sách các chi nhánh rạp đang hoạt động
 * @throws Không ném ngoại lệ nghiệp vụ (trả mảng rỗng nếu không có dữ liệu)
 */
export interface GetPublicBranchesUsecase {
  getPublicBranches(
    query?: GetPublicBranchesReqDto,
  ): Promise<PublicBranchResDto[]>;
}
