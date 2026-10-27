import { RoomOptionResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp thông tin phòng chiếu (chi nhánh, trạng thái, tên)
 * để module xếp lịch kiểm tra phòng hợp lệ và hiển thị tên phòng.
 */
export interface GetRoomSchedulingInfoUsecase {
  /**
   * Lấy thông tin một phòng chiếu
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm phòng theo roomId
   * 2. Ánh xạ sang RoomOptionResDto
   *
   * @param roomId - Mã phòng chiếu
   * @returns Thông tin phòng, hoặc null nếu không tồn tại
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getRoomSchedulingInfo(roomId: string): Promise<RoomOptionResDto | null>;

  /**
   * Lấy thông tin nhiều phòng chiếu cùng lúc (phục vụ hiển thị danh sách)
   *
   * Quy trình nghiệp vụ:
   * 1. Nếu danh sách rỗng, trả về mảng rỗng mà không truy vấn
   * 2. Tìm các phòng có roomId thuộc danh sách
   * 3. Ánh xạ sang RoomOptionResDto (id không tồn tại sẽ vắng mặt)
   *
   * @param roomIds - Danh sách mã phòng
   * @returns Danh sách thông tin các phòng tìm thấy
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  getRoomSchedulingInfos(roomIds: string[]): Promise<RoomOptionResDto[]>;
}
