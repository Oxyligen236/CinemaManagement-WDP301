/**
 * Nghiệp vụ ghi nhận lịch sử khách hàng đã sử dụng mã khuyến mãi sau khi thanh toán thành công.
 */
export interface RecordPromotionUsageUsecase {
  /**
   * Tạo bản ghi lịch sử sử dụng khuyến mãi và tăng số lượt đã dùng của mã.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra tính tồn tại của bản ghi sử dụng `(promotionId, userId)` trong cơ sở dữ liệu.
   * 2. Lưu bản ghi `PromotionUsage` mới chứa thông tin người dùng, đơn hàng và thời gian dùng.
   * 3. Cập nhật tăng số lượt đã sử dụng (`usedCount`) của mã khuyến mãi thêm 1.
   *
   * @param params - Thông tin ghi nhận gồm ID khuyến mãi, ID người dùng và ID đơn hàng.
   * @returns Promise rỗng khi hoàn tất.
   * @throws ConflictException khi người dùng đã có bản ghi sử dụng mã này trước đó.
   */
  recordPromotionUsage(params: {
    promotionId: string;
    userId: string;
    orderId: string;
  }): Promise<void>;
}
