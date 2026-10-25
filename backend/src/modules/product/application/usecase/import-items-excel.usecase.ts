import { ImportItemsExcelReq } from '../dto/req.dto';
import { ImportItemsExcelRes } from '../dto/res.dto';

/**
 * Usecase nhập dữ liệu sản phẩm đơn (Item) và tồn kho kiểm kê từ file Excel.
 * Phục vụ nhu cầu kiểm kê hàng hóa định kỳ của Quản lý chi nhánh.
 */
export interface ImportItemsExcelUsecase {
  /**
   * Xử lý đọc file Excel và cập nhật / tạo mới sản phẩm theo chi nhánh.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Parse file buffer Excel (.xlsx, .xls), kiểm tra tiêu đề các cột chuẩn.
   * 3. Duyệt từng dòng dữ liệu, validate kiểu dữ liệu, bắt buộc tên, danh mục, giá, tồn kho.
   * 4. Thực hiện Upsert: nếu tên sản phẩm đã tồn tại -> cập nhật thông tin và cập nhật tồn kho (theo chế độ ghi đè kiểm kê hoặc cộng dồn); nếu chưa -> tạo mới.
   * 5. Tổng hợp báo cáo kết quả: số dòng thành công, số dòng lỗi, danh sách lỗi chi tiết theo dòng.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param fileBuffer - Buffer dữ liệu nhị phân của file Excel upload
   * @param req - Tùy chọn cấu hình import (chế độ tồn kho OVERWRITE hoặc ACCUMULATE)
   * @returns Báo cáo kết quả import sản phẩm
   * @throws BadRequestException khi file rỗng hoặc không đúng định dạng
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  importItemsExcel(
    managerUserId: string,
    fileBuffer: Buffer,
    req?: ImportItemsExcelReq,
  ): Promise<ImportItemsExcelRes>;
}
