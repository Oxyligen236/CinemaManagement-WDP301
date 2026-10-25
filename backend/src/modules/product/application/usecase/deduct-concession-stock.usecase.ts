/**
 * Usecase khấu trừ tồn kho bắp nước khi đơn hàng thanh toán thành công.
 */
export interface DeductConcessionStockUsecase {
  /**
   * Khấu trừ số lượng tồn kho của các sản phẩm hoặc combo trong đơn hàng.
   *
   * Quy trình nghiệp vụ:
   * 1. Phân loại danh sách sản phẩm thành Item và Combo.
   * 2. Với Combo, phân rã các item con và nhân số lượng tương ứng.
   * 3. Tổng hợp số lượng cần trừ cho từng itemId.
   * 4. Thực hiện cập nhật nguyên tử trừ stockQuantity với điều kiện stockQuantity >= số lượng cần trừ.
   * 5. Cập nhật trạng thái OUT_OF_STOCK nếu tồn kho về 0.
   *
   * @param items - Danh sách các sản phẩm và số lượng cần trừ ({ productId: string; quantity: number }[])
   * @returns Không trả về dữ liệu nếu thành công
   * @throws ConflictException khi số lượng tồn kho không đủ để khấu trừ
   */
  deductConcessionStock(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void>;
}
