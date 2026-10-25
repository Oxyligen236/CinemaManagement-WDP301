/**
 * Giá trị nghiệp vụ: Kiểm tra điều kiện xếp lịch của suất chiếu (phòng trống
 * thời gian, suất chiếu đã bán vé hay chưa).
 */
export interface CheckRoomAvailabilityUsecase {
  /**
   * Kiểm tra phòng có suất chiếu chồng lấn khoảng thời gian cho trước.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm suất chiếu cùng phòng có startTime < endTime mới và endTime > startTime mới
   * 2. Bỏ qua suất chiếu có mã excludeShowtimeId (khi đang sửa chính nó)
   *
   * @param roomId - Mã phòng chiếu
   * @param startTime - Thời điểm bắt đầu (bao gồm)
   * @param endTime - Thời điểm kết thúc (loại trừ)
   * @param excludeShowtimeId - Mã suất chiếu bỏ qua khi kiểm tra
   * @returns true nếu có ít nhất một suất chồng lấn
   */
  hasRoomConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeShowtimeId?: string,
  ): Promise<boolean>;

  /**
   * Kiểm tra suất chiếu đã bán vé hay chưa.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm SeatShowtime của suất chiếu có seatStatus khác EMPTY
   *
   * @param showtimeId - Mã suất chiếu
   * @returns true nếu có ghế BOOKED hoặc RESERVED
   */
  hasSoldTickets(showtimeId: string): Promise<boolean>;

  /**
   * Xác định hàng loạt suất chiếu nào đã bán vé (một truy vấn).
   *
   * Quy trình nghiệp vụ:
   * 1. Truy vấn SeatShowtime có showtimeId thuộc danh sách và seatStatus khác EMPTY
   * 2. Gom các showtimeId duy nhất
   *
   * @param showtimeIds - Danh sách mã suất chiếu
   * @returns Tập mã suất chiếu đã bán vé
   */
  findSoldShowtimeIds(showtimeIds: string[]): Promise<Set<string>>;
}
