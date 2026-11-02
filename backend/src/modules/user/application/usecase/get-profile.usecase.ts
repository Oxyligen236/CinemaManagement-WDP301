import { UserProfileRes } from '../dto/res.dto';

/**
 * Usecase truy vấn thông tin hồ sơ người dùng đang đăng nhập.
 * Phục vụ hiển thị hồ sơ cá nhân trên các giao diện quản trị và khách hàng.
 */
export interface GetProfileUsecase {
  /**
   * Lấy chi tiết thông tin hồ sơ của tài khoản dựa trên ID.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm thông tin người dùng trong cơ sở dữ liệu theo userId.
   * 2. Kiểm tra trạng thái hoạt động (isActive) của tài khoản.
   * 3. Chuyển đổi dữ liệu sang định dạng UserProfileRes an toàn (loại bỏ password).
   *
   * @param userId - Mã định danh duy nhất của người dùng từ access token
   * @returns Thông tin hồ sơ chi tiết của người dùng
   * @throws NotFoundException khi không tìm thấy tài khoản hợp lệ
   * @throws UnauthorizedException khi tài khoản bị khóa hoặc vô hiệu hóa
   */
  execute(userId: string): Promise<UserProfileRes>;
}
