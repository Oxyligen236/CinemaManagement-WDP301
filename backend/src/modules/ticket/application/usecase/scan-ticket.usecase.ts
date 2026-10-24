import { ScanTicketReq } from '../dto/req.dto';
import { ScanTicketResultRes } from '../dto/res.dto';

/**
 * Soát vé rạp chiếu phim dựa trên mã vé (QR) dành cho nhân viên rạp (Staff)
 *
 * Quy trình nghiệp vụ:
 * 1. Tìm thông tin vé qua ticketCode.
 * 2. Kiểm tra trạng thái vé: Bắt buộc là VALID. Nếu USED ném BadRequestException; nếu CANCELLED/EXPIRED ném BadRequestException.
 * 3. Lấy thông tin suất chiếu từ ShowtimeModule qua ShowtimeContract.
 * 4. Kiểm tra thời gian: Thời điểm quét phải nằm trong khung giờ check-in (từ trước giờ chiếu 30 phút đến hết phim).
 * 5. Cập nhật vé: ticketStatus = USED, usedAt = now(), scannedBy = staffId.
 * 6. Phát hành TicketScannedEvent và trả về kết quả quét hợp lệ kèm thông tin phim, phòng, ghế.
 *
 * @param dto - ScanTicketReq chứa ticketCode và showtimeId đang được soát (nếu có)
 * @param staffId - ID nhân viên thực hiện quét
 * @returns ScanTicketResultRes thông tin chi tiết vé đã check-in thành công
 * @throws NotFoundException khi không tìm thấy vé
 * @throws BadRequestException khi vé không hợp lệ hoặc sai suất chiếu
 */
export interface ScanTicketUsecase {
  scanTicket(dto: ScanTicketReq, staffId: string): Promise<ScanTicketResultRes>;
}
