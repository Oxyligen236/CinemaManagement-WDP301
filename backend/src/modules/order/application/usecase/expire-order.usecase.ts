/**
 * Hết hạn đơn hàng PENDING và nhả ghế về trạng thái EMPTY
 *
 * Quy trình nghiệp vụ:
 * 1. Cập nhật có điều kiện trạng thái đơn hàng từ PENDING sang EXPIRED
 * 2. Nếu cập nhật thành công, gọi ShowtimeBookingService để nhả ghế RESERVED về EMPTY
 * 3. Phát tán OrderExpiredEvent qua internal event bus
 * 4. Xử lý idempotent: bỏ qua nếu đơn đã thanh toán hoặc đã hủy
 *
 * @param orderId - ID đơn hàng cần xử lý hết hạn
 * @returns boolean true nếu đơn thực sự bị hết hạn, false nếu bỏ qua
 * @throws Error khi quá trình cập nhật hoặc nhả ghế gặp sự cố hệ thống
 */
export interface ExpireOrderUsecase {
  expireOrder(orderId: string): Promise<boolean>;
}
