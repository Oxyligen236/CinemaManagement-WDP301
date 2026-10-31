import { VerificationStatusRes } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cho phép màn hình xác thực email phục hồi đúng trạng thái
 * sau khi người dùng thoát ra rồi quay lại, nhờ đọc thời gian còn lại thật của
 * mã xác thực và của cooldown gửi lại mã thay vì đếm lại từ đầu.
 */
export interface GetVerificationStatusUsecase {
  /**
   * Lấy trạng thái đăng ký đang chờ xác thực của một email
   *
   * Quy trình nghiệp vụ:
   * 1. Chuẩn hóa email (trim, lowercase)
   * 2. Tra cứu đăng ký đang chờ xác thực; mã đã hết hạn được coi là không còn
   * 3. Tính số giây còn lại của mã và của cooldown gửi lại mã
   *
   * @param email - Email cần tra cứu trạng thái xác thực
   * @returns Trạng thái chờ xác thực kèm thời gian còn lại; `pending = false` khi không có đăng ký nào đang chờ
   */
  getVerificationStatus(email: string): Promise<VerificationStatusRes>;
}
