import { TicketItemSummaryRes } from '../dto/res.dto';

/**
 * Nghiệp vụ phát hành vé xem phim sau khi đơn hàng được thanh toán thành công.
 */
export interface CreateTicketsForOrderUsecase {
  /**
   * Phát hành danh sách vé xem phim tương ứng với các ghế trong đơn hàng đã thanh toán.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra đơn hàng đã có vé được tạo trước đó chưa (đảm bảo tính idempotent); nếu có trả về danh sách vé hiện tại.
   * 2. Lấy thông tin chi tiết từng ghế suất chiếu qua ShowtimeModule/ShowtimeContract.
   * 3. Sinh mã ticketCode duy nhất cho từng vé, tạo bản ghi Ticket với trạng thái VALID gắn với đơn hàng.
   * 4. Trả về danh sách tóm tắt thông tin các vé vừa được phát hành.
   *
   * @param orderId - Mã định danh đơn hàng cần phát hành vé
   * @param items - Danh sách các mục ghế bao gồm seatShowtimeId và đơn giá vé
   * @returns TicketItemSummaryRes[] Danh sách thông tin vé đã được phát hành thành công
   * @throws BadRequestException khi thông tin ghế hoặc đơn hàng không hợp lệ để phát hành vé
   */
  createTicketsForOrder(
    orderId: string,
    items: Array<{ seatShowtimeId: string; price: number }>,
  ): Promise<TicketItemSummaryRes[]>;
}
