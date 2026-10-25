import { PosReceiptRes } from '../dto/res.dto';

/**
 * Nghiệp vụ trích xuất dữ liệu hóa đơn và vé xem phim phục vụ in nhiệt khổ 80mm tại quầy.
 */
export interface GetPosReceiptUsecase {
  /**
   * Lấy toàn bộ dữ liệu định dạng hóa đơn bán hàng và vé xem phim để in hóa đơn nhiệt 80mm.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId, xác thực chi nhánh và đảm bảo đơn đã thanh toán (PAID).
   * 2. Lấy danh sách vé đã phát hành kèm thông tin suất chiếu, phòng chiếu, tên phim từ TicketContract.
   * 3. Lấy danh sách sản phẩm bắp nước từ ProductOrder và chi tiết tên, giá.
   * 4. Lấy thông tin chi nhánh (tên rạp, địa chỉ) và thông tin nhân viên thu ngân.
   * 5. Tổng hợp và trả về cấu trúc dữ liệu đầy đủ cho máy in nhiệt 80mm.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param orderId - Mã định danh đơn hàng cần in hóa đơn
   * @returns PosReceiptRes Cấu trúc dữ liệu đầy đủ cho máy in hóa đơn 80mm
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc chi nhánh của nhân viên
   * @throws BadRequestException khi đơn hàng chưa hoàn tất thanh toán
   */
  getPosReceipt(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
  ): Promise<PosReceiptRes>;
}
