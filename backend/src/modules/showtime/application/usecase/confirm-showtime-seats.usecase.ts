/**
 * Giá trị nghiệp vụ: Xác nhận chuyển các ghế đang tạm giữ thành ghế đã bán (BOOKED)
 */
export interface ConfirmShowtimeSeatsUsecase {
  /**
   * Chuyển các ghế thuộc suất chiếu từ RESERVED sang BOOKED.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra danh sách ghế đầu vào không rỗng và duy nhất.
   * 2. Thực hiện cập nhật nguyên tử có điều kiện seatStatus: RESERVED -> BOOKED.
   * 3. Trả về số lượng ghế đã được chuyển trạng thái.
   *
   * @param seatShowtimeIds - Danh sách mã ghế suất chiếu cần khóa
   * @returns Số lượng ghế thực tế đã chuyển sang BOOKED
   * @throws ConflictException khi số ghế cập nhật không khớp số lượng yêu cầu
   */
  confirmSeats(seatShowtimeIds: string[], prismaTx?: any): Promise<number>;
}
