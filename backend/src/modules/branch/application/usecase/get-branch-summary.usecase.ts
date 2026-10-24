import { BranchSummaryResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp thông tin tóm tắt chi nhánh (mã, tên)
 * để hiển thị ngữ cảnh chi nhánh cho các màn hình quản lý.
 */
export interface GetBranchSummaryUsecase {
  /**
   * Lấy thông tin tóm tắt của một chi nhánh
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm chi nhánh theo branchId
   * 2. Ánh xạ sang BranchSummaryResDto
   *
   * @param branchId - Mã chi nhánh
   * @returns Thông tin tóm tắt, hoặc null nếu chi nhánh không tồn tại
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getBranchSummary(branchId: string): Promise<BranchSummaryResDto | null>;
}
