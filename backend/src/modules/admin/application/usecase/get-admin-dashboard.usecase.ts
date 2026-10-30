import { AdminDashboardRes } from '../dto/res.dto';

/**
 * Cung cấp số liệu thống kê tổng quan và thông tin quản trị viên cho Admin Dashboard.
 */
export interface GetAdminDashboardUsecase {
  /**
   * Truy vấn thông tin người quản trị và các chỉ số đo lường toàn hệ thống.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra thông tin định danh và quyền hạn của Admin từ token payload.
   * 2. Đếm tổng số người dùng, số tài khoản hoạt động và số tài khoản bị khóa trong database.
   * 3. Đếm số lượng khách hàng đã đăng ký (người dùng có vai trò Role.USER).
   * 4. Tổng hợp số lượng tài khoản theo từng vai trò (ADMIN, MANAGER, STAFF, USER).
   * 5. Truy vấn tổng số lượng tập tin đã tải lên từ dịch vụ lưu trữ StorageService.
   * 6. Tổng hợp dữ liệu thành DTO AdminDashboardRes và trả về.
   *
   * @param adminUser - Đối tượng thông tin quản trị viên lấy từ JWT payload
   * @returns Dữ liệu bảng điều khiển AdminDashboardRes
   * @throws ForbiddenException khi người dùng không có quyền truy cập
   */
  getDashboard(adminUser: {
    userId?: string;
    sub?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AdminDashboardRes>;
}
