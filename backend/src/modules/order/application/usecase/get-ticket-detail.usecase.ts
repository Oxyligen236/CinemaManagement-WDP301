import { TicketDetailRes } from '../dto/res.dto';

/**
 * Nghiệp vụ tra cứu thông tin chi tiết vé xem phim theo mã vé.
 */
export interface GetTicketDetailUsecase {
  /**
   * Lấy thông tin chi tiết của vé xem phim bao gồm phim, phòng chiếu, ghế và chi nhánh.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu thông tin vé qua mã vé (ticketCode), ném NotFoundException nếu không tìm thấy vé.
   * 2. Lấy thông tin chi tiết suất chiếu, phim, phòng chiếu và ghế từ ShowtimeModule qua ShowtimeContract.
   * 3. Tổng hợp và trả về thông tin chi tiết đầy đủ của vé xem phim.
   *
   * @param ticketCode - Mã định danh vé xem phim (dạng chuỗi duy nhất)
   * @returns TicketDetailRes Thông tin chi tiết vé xem phim kèm suất chiếu, ghế và chi nhánh
   * @throws NotFoundException khi không tìm thấy vé xem phim với mã cung cấp
   */
  getTicketDetail(ticketCode: string): Promise<TicketDetailRes>;
}
