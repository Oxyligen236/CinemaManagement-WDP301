import { ManagerContextResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho giao diện Manager biết chi nhánh đang quản lý để hiển thị tiêu đề màn hình.
 */
export interface GetManagerContextUsecase {
  /**
   * Lấy chi nhánh của Manager.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra branchId của Manager theo userId
   * 2. Lấy tên chi nhánh
   *
   * @param userId - Mã người dùng (JWT sub) của Manager
   * @returns Mã và tên chi nhánh
   * @throws ForbiddenException khi Manager chưa được gán chi nhánh hoặc chi nhánh không tồn tại
   * @throws InternalServerErrorException khi không tải được dữ liệu
   */
  getManagerContext(userId: string): Promise<ManagerContextResDto>;
}
