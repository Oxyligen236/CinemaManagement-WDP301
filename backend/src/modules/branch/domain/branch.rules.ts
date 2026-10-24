export const BRANCH_MESSAGES = {
  MSG01_NO_RESULTS: 'Không tìm thấy kết quả phù hợp.',
  MSG02_REQUIRED: 'Vui lòng nhập đầy đủ các trường thông tin bắt buộc.',
  MSG03_UPDATED: 'Cập nhật thông tin chi nhánh thành công.',
  MSG04_CREATED: 'Thêm chi nhánh rạp mới thành công.',
  MSG06_CANNOT_DEACTIVATE:
    'Không thể vô hiệu hóa hoặc xóa chi nhánh đang có phòng chiếu hoạt động hoặc suất chiếu sắp diễn ra.',
  BRANCH_NAME_EXISTS: 'Tên chi nhánh đã tồn tại trên hệ thống.',
  BRANCH_NOT_FOUND: 'Không tìm thấy thông tin chi nhánh.',
  ROOM_NAME_EXISTS: 'Tên phòng chiếu đã tồn tại trong chi nhánh này.',
  ROOM_CREATED: 'Đã tạo phòng chiếu mới và khởi tạo sơ đồ ghế thành công.',
  SERVICE_UNAVAILABLE:
    'Không thể xử lý yêu cầu chi nhánh do lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.',
} as const;

/**
 * BR-ADM-03: Chi nhánh không thể bị vô hiệu hóa / xóa nếu đang có phòng chiếu hoạt động (AVAILABLE)
 * hoặc suất chiếu đang / sắp diễn ra.
 */
export function canDeactivateBranch(
  activeRoomsCount: number,
  upcomingShowtimesCount: number,
): boolean {
  return activeRoomsCount === 0 && upcomingShowtimesCount === 0;
}
