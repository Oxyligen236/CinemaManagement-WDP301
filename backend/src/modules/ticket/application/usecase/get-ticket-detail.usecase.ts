import { TicketDetailRes } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Tra cứu thông tin chi tiết vé xem phim theo mã vé
 */
export interface GetTicketDetailUsecase {
  /**
   * Tra cứu thông tin chi tiết vé xem phim theo mã vé
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm thông tin vé qua ticketCode.
   * 2. Lấy thông tin chi tiết suất chiếu, phim, phòng, ghế từ ShowtimeModule qua ShowtimeContract.
   * 3. Trả về thông tin chi tiết của vé.
   *
   * @param ticketCode - Mã vé cần tra cứu
   * @returns TicketDetailRes thông tin chi tiết vé
   * @throws NotFoundException khi không tìm thấy vé
   */
  getTicketDetail(ticketCode: string): Promise<TicketDetailRes>;
}
