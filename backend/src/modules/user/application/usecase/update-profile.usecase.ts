import { UpdateProfileReq } from '../dto/req.dto';
import { UserProfileRes } from '../dto/res.dto';

/**
 * Usecase cập nhật thông tin cá nhân của người dùng.
 * Cho phép chỉnh sửa họ và tên hiển thị trong hệ thống.
 */
export interface UpdateProfileUsecase {
  /**
   * Cập nhật thông tin họ tên người dùng theo userId.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra sự tồn tại và tính hợp lệ của tài khoản theo userId.
   * 2. Tiến hành cập nhật các trường firstName, lastName vào cơ sở dữ liệu.
   * 3. Trả về thông tin hồ sơ mới nhất sau khi cập nhật.
   *
   * @param userId - Mã định danh của người dùng thực hiện cập nhật
   * @param req - Dữ liệu yêu cầu cập nhật hồ sơ
   * @returns Hồ sơ người dùng sau khi đã cập nhật thành công
   * @throws NotFoundException khi không tìm thấy tài khoản
   * @throws BadRequestException khi dữ liệu cập nhật không hợp lệ
   */
  execute(userId: string, req: UpdateProfileReq): Promise<UserProfileRes>;
}
