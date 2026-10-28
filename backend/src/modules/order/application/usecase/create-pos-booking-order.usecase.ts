import { CreatePosOrderReq } from '../dto/req.dto';
import { PosBookingSummaryRes } from '../dto/res.dto';

/**
 * Nghiệp vụ tạo đơn đặt vé và bắp nước tại quầy POS bởi nhân viên thu ngân.
 */
export interface CreatePosBookingOrderUsecase {
  /**
   * Tạo đơn hàng POS giữ chỗ ghế và sản phẩm bắp nước tạm thời trong 10 phút.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra quyền của nhân viên và chi nhánh trực thuộc.
   * 2. Nếu có ghế: xác thực suất chiếu và ghế thuộc phòng chiếu cùng chi nhánh, giữ ghế qua ShowtimeBookingService.
   * 3. Nếu chỉ có sản phẩm F&B: bỏ qua giữ chỗ ghế, ghi nhận chi nhánh vào đơn hàng.
   * 4. Kiểm tra và xác nhận danh mục sản phẩm F&B thuộc chi nhánh.
   * 5. Tạo đơn hàng với userId là staffId, chi nhánh tương ứng và trạng thái PENDING.
   * 6. Đưa job kiểm tra hết hạn vào hàng đợi với thời gian giữ 10 phút.
   * 7. Phát tán OrderCreatedEvent qua internal event bus.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param request - Dữ liệu yêu cầu tạo đơn POS gồm showtimeId, seatShowtimeIds, products
   * @returns PosBookingSummaryRes Thông tin tóm tắt đơn giữ chỗ tại quầy
   * @throws ForbiddenException khi suất chiếu hoặc sản phẩm không thuộc chi nhánh nhân viên
   * @throws ConflictException khi ghế đã có người giữ hoặc không khả dụng
   * @throws NotFoundException khi sản phẩm hoặc suất chiếu không tồn tại
   * @throws BadRequestException khi đơn hàng không có cả ghế lẫn sản phẩm F&B
   */
  createPosBookingOrder(
    staffContext: { staffId: string; branchId: string },
    request: CreatePosOrderReq,
  ): Promise<PosBookingSummaryRes>;
}
