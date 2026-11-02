import { ChangePasswordReq } from '../dto/req.dto';

/**
 * Usecase thay đổi mật khẩu người dùng đang đăng nhập.
 * Đảm bảo tính bảo mật và vô hiệu hóa phiên đăng nhập cũ.
 */
export interface ChangePasswordUsecase {
  /**
   * Xác thực mật khẩu cũ và lưu mật khẩu mới đã mã hóa.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm tài khoản trong cơ sở dữ liệu bao gồm cả trường password hash.
   * 2. So khớp mật khẩu hiện tại bằng bcrypt.
   * 3. Kiểm tra mật khẩu mới không được trùng mật khẩu cũ.
   * 4. Mã hóa mật khẩu mới bằng bcrypt với salt round là 10.
   * 5. Cập nhật mật khẩu mới và tăng tokenVersion lên 1 đơn vị.
   *
   * @param userId - Mã định danh của người dùng yêu cầu đổi mật khẩu
   * @param req - Dữ liệu mật khẩu hiện tại và mật khẩu mới
   * @returns Thông báo kết quả thực hiện thành công
   * @throws NotFoundException khi không tìm thấy người dùng
   * @throws BadRequestException khi mật khẩu cũ không đúng hoặc mật khẩu mới trùng mật khẩu cũ
   */
  execute(userId: string, req: ChangePasswordReq): Promise<{ message: string }>;
}
