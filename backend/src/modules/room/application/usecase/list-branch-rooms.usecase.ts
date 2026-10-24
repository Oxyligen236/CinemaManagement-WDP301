import { RoomOptionResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Cung cấp danh sách phòng chiếu của một chi nhánh
 * để Manager chọn phòng khi xếp lịch chiếu.
 */
export interface ListBranchRoomsUsecase {
  /**
   * Liệt kê mọi phòng chiếu của chi nhánh
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm các phòng có branchId trùng khớp (mọi trạng thái)
   * 2. Sắp xếp theo roomName tăng dần
   * 3. Ánh xạ sang RoomOptionResDto (kèm roomStatus để caller tự quyết định phòng khả dụng)
   *
   * @param branchId - Mã chi nhánh
   * @returns Danh sách phòng của chi nhánh
   * @throws Error khi truy vấn cơ sở dữ liệu thất bại
   */
  listRoomsByBranch(branchId: string): Promise<RoomOptionResDto[]>;
}
