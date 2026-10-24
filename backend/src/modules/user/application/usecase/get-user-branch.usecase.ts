/**
 * Giá trị nghiệp vụ: Cho phép module khác biết người dùng (Manager) thuộc chi nhánh nào
 * để giới hạn phạm vi dữ liệu theo chi nhánh.
 */
export interface GetUserBranchUsecase {
  /**
   * Lấy mã chi nhánh của người dùng
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm người dùng theo userId
   * 2. Nếu không tồn tại hoặc bị khóa (isActive = false), trả về null
   * 3. Trả về branchId, hoặc null nếu người dùng chưa được gán chi nhánh
   *
   * @param userId - Mã người dùng (JWT sub)
   * @returns branchId của người dùng, hoặc null khi không tồn tại/bị khóa/chưa gán chi nhánh
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getBranchIdOfUser(userId: string): Promise<string | null>;
}
