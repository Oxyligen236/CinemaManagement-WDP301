import { Page } from '../../../../common/dto/page.dto';
import { QueryBranchCombosReq } from '../dto/req.dto';
import { ComboRes } from '../dto/res.dto';

/**
 * Usecase truy vấn danh sách gói Combo thuộc chi nhánh của quản lý, có phân trang và lọc theo trạng thái, từ khóa.
 */
export interface QueryBranchCombosUsecase {
  /**
   * Lấy danh sách Combo phân trang kèm tính toán động tồn kho ảo cho từng combo.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Xây dựng bộ lọc theo `branchId`, `status` và `search` (theo tên combo).
   * 3. Thực hiện phân trang (skip, limit) và đếm tổng số bản ghi thỏa mãn điều kiện.
   * 4. Thu thập toàn bộ danh sách `itemId` từ các combo trả về, truy vấn thông tin tồn kho và trạng thái món con từ collection `items`.
   * 5. Tính toán động cho từng combo: `availableStock`, `isAvailable`, `originalTotalPrice`, `savingsAmount`.
   * 6. Trả về đối tượng `Page<ComboRes>`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param req - DTO chứa tham số phân trang và lọc dữ liệu
   * @returns Trang dữ liệu danh sách Combo
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   */
  queryBranchCombos(
    managerUserId: string,
    req: QueryBranchCombosReq,
  ): Promise<Page<ComboRes>>;
}
