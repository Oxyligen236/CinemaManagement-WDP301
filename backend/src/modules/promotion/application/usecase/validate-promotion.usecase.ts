/**
 * Nghiệp vụ thẩm định tính hợp lệ của mã khuyến mãi cho khách hàng.
 */
export interface ValidatePromotionUsecase {
  /**
   * Thẩm định tính hợp lệ của mã khuyến mãi và tính toán số tiền được giảm giá cho đơn hàng.
   *
   * Quy trình nghiệp vụ:
   * 1. Chuẩn hóa mã khuyến mãi đầu vào (cắt khoảng trắng, viết hoa). Nếu rỗng trả về không hợp lệ.
   * 2. Tra cứu mã khuyến mãi trong cơ sở dữ liệu. Nếu không tìm thấy trả về không hợp lệ.
   * 3. Kiểm tra trạng thái hoạt động `isActive`. Nếu đang tắt trả về không hợp lệ.
   * 4. Kiểm tra thời gian hiệu lực (phải nằm trong khoảng từ `startDate` đến `endDate`).
   * 5. Kiểm tra giá trị đơn hàng tối thiểu `minOrderValue` nếu có quy định.
   * 6. Kiểm tra giới hạn số lượt sử dụng tổng thể `usageLimit` (`usedCount` >= `usageLimit`).
   * 7. Kiểm tra giới hạn người dùng: Nếu `userId` được cung cấp, tra cứu trong `PromotionUsage`.
   *    Nếu người dùng đã từng sử dụng mã này, trả về không hợp lệ với thông báo từ chối.
   * 8. Tính toán số tiền giảm giá dựa theo loại giảm giá và giới hạn số tiền giảm tối đa `maxDiscountAmount`.
   *
   * @param params - Dữ liệu thẩm định gồm mã khuyến mãi, số tiền đơn hàng và ID người dùng.
   * @returns Kết quả thẩm định gồm cờ hợp lệ, ID khuyến mãi, số tiền giảm và lý do từ chối nếu có.
   */
  validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<{
    isValid: boolean;
    promotionId?: string;
    promotionCode?: string;
    discountType?: string;
    discountValue?: number;
    discountAmount: number;
    reason?: string;
  }>;
}
