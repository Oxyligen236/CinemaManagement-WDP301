/**
 * Usecase xuất file Excel mẫu (template) chuẩn cho quản lý chi nhánh tải về nhập liệu.
 */
export interface GetItemExcelTemplateUsecase {
  /**
   * Tạo buffer file Excel (.xlsx) chứa cấu trúc bảng mẫu chuẩn và dữ liệu ví dụ minh họa.
   *
   * Quy trình nghiệp vụ:
   * 1. Khởi tạo workbook Excel với sheet "DanhSachSanPham".
   * 2. Định nghĩa các cột: Tên món, Danh mục, Kích cỡ, Giá bán, Tồn kho, Ngưỡng cảnh báo, Giá vốn, Mô tả.
   * 3. Điền các dòng dữ liệu mẫu đại diện cho Bắp, Nước, Snack kèm ghi chú danh mục hợp lệ.
   * 4. Xuất ra dạng binary Buffer.
   *
   * @returns Binary Buffer chứa file Excel template
   */
  getItemExcelTemplate(): Promise<Buffer>;
}
