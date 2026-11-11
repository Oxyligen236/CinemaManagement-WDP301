import { StaffScanContextReq, ScanTicketReq } from '../dto/req.dto';
import { ScanTicketResultRes } from '../dto/res.dto';

/**
 * Nghiệp vụ soát vé xem phim dựa trên mã vé (QR) cho nhân viên hoặc quản trị viên tại rạp.
 */
export interface ScanTicketUsecase {
  /**
   * Quét và xác thực vé xem phim, cập nhật trạng thái vé thành USED nếu hợp lệ.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu thông tin vé qua mã vé (ticketCode), ném NotFoundException nếu không tìm thấy vé.
   * 2. Kiểm tra trạng thái vé: bắt buộc là VALID. Ném BadRequestException nếu vé đã sử dụng (USED), đã hủy (CANCELLED) hoặc hết hạn (EXPIRED).
   * 3. Lấy thông tin suất chiếu và chi nhánh liên quan từ ShowtimeModule/ShowtimeContract.
   * 4. Xác thực quyền chi nhánh của người soát:
   *    - Nhân viên (STAFF): chi nhánh phụ trách (staffContext.branchId) bắt buộc phải khớp với chi nhánh của suất chiếu, ném ForbiddenException nếu sai hoặc chưa gán chi nhánh.
   *    - Quản trị viên (ADMIN): có quyền soát vé tại mọi chi nhánh.
   * 5. Kiểm tra thời gian check-in: thời điểm quét phải nằm trong khung giờ hợp lệ (từ 30 phút trước giờ bắt đầu chiếu đến khi kết thúc phim).
   * 6. Cập nhật trạng thái vé thành USED, ghi nhận usedAt = thời điểm quét và scannedBy = staffContext.staffId.
   * 7. Phát hành TicketScannedEvent qua event emitter để thông báo hệ thống và audit log.
   * 8. Trả về thông tin chi tiết vé kèm thông điệp xác nhận soát vé thành công.
   *
   * @param staffContext - Ngữ cảnh nhân viên/quản trị viên thực hiện quét vé (staffId, branchId, role)
   * @param req - Dữ liệu yêu cầu quét vé chứa mã vé (ticketCode) và mã suất chiếu tùy chọn (showtimeId)
   * @returns ScanTicketResultRes Kết quả soát vé hợp lệ kèm chi tiết vé và thông điệp thành công
   * @throws NotFoundException khi không tìm thấy vé xem phim tương ứng với mã cung cấp
   * @throws BadRequestException khi trạng thái vé không phải VALID hoặc thời gian quét không hợp lệ
   * @throws ForbiddenException khi nhân viên không có quyền soát vé tại chi nhánh của suất chiếu
   */
  scanTicket(
    staffContext: StaffScanContextReq,
    req: ScanTicketReq,
  ): Promise<ScanTicketResultRes>;
}
