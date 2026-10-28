import { ScanTicketReq, StaffScanContextReq } from '../dto/req.dto';
import { ScanTicketResultRes } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Soát vé rạp chiếu phim dựa trên mã vé (QR) cho nhân viên hoặc quản trị viên
 */
export interface ScanTicketUsecase {
  /**
   * Soát vé rạp chiếu phim dựa trên mã vé (QR) và kiểm tra quyền theo chi nhánh
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm thông tin vé qua ticketCode.
   * 2. Kiểm tra trạng thái vé: Bắt buộc là VALID. Nếu USED ném BadRequestException; nếu CANCELLED/EXPIRED ném BadRequestException.
   * 3. Lấy thông tin suất chiếu từ ShowtimeModule qua ShowtimeContract.
   * 4. Kiểm tra quyền chi nhánh: Nếu actor là STAFF, yêu cầu phải có branchId và branchId phải khớp với branchId của suất chiếu. Nếu sai chi nhánh hoặc chưa gán chi nhánh ném ForbiddenException. ADMIN được phép soát mọi chi nhánh.
   * 5. Kiểm tra thời gian: Thời điểm quét phải nằm trong khung giờ check-in (từ trước giờ chiếu 30 phút đến hết phim).
   * 6. Cập nhật vé: ticketStatus = USED, usedAt = now(), scannedBy = staffContext.staffId.
   * 7. Phát hành TicketScannedEvent và trả về kết quả quét hợp lệ kèm thông tin phim, phòng, ghế, chi nhánh.
   *
   * @param dto - ScanTicketReq chứa ticketCode và showtimeId đang được soát (nếu có)
   * @param staffContext - Ngữ cảnh người soát vé gồm staffId, branchId và vai trò role
   * @returns ScanTicketResultRes thông tin chi tiết vé đã check-in thành công
   * @throws NotFoundException khi không tìm thấy vé
   * @throws BadRequestException khi vé không hợp lệ hoặc sai suất chiếu hoặc sai thời gian
   * @throws ForbiddenException khi nhân viên chưa gán chi nhánh hoặc soát vé tại chi nhánh khác
   */
  scanTicket(
    dto: ScanTicketReq,
    staffContext: StaffScanContextReq,
  ): Promise<ScanTicketResultRes>;
}
