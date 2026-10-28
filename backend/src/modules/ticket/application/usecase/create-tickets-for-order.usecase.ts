import { TicketItemSummaryRes } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Phát hành vé xem phim sau khi đơn hàng thanh toán thành công
 */
export interface CreateTicketsForOrderUsecase {
  /**
   * Sinh bản ghi vé cho từng ghế trong đơn hàng đã thanh toán.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra đơn hàng đã có vé chưa; nếu có trả về danh sách vé hiện tại (idempotent).
   * 2. Lấy chi tiết từng ghế suất chiếu qua ShowtimeContract.
   * 3. Sinh mã ticketCode duy nhất và tạo bản ghi Ticket với trạng thái VALID.
   * 4. Trả về danh sách chi tiết vé vừa phát hành.
   *
   * @param params - Đối tượng chứa orderId và seatShowtimeIds
   * @param params.orderId - Mã đơn hàng đã thanh toán
   * @param params.seatShowtimeIds - Danh sách mã ghế suất chiếu cần phát hành vé
   * @returns Danh sách vé đã phát hành kèm thông tin phòng, phim, suất chiếu
   * @throws BadRequestException khi danh sách ghế rỗng hoặc không tìm thấy thông tin suất chiếu
   */
  createTicketsForOrder(
    params: {
      orderId: string;
      seatShowtimeIds: string[];
    },
    session?: ClientSession,
  ): Promise<TicketItemSummaryRes[]>;
}
import { ClientSession } from 'mongoose';
