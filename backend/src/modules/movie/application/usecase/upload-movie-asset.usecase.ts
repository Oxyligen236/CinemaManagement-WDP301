import { UploadMovieAssetResDto } from '../dto/res.dto';

/**
 * Giá trị nghiệp vụ: Tải ảnh poster phim lên hệ thống lưu trữ đối tượng (S3/R2)
 * để dùng khi tạo phim, thay cho việc nhập URL poster thủ công
 */
export interface UploadMovieAssetUsecase {
  /**
   * Tải lên ảnh poster phim
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra file tồn tại và có dữ liệu, ngược lại báo thiếu trường file
   * 2. Kiểm tra định dạng (JPG, PNG, WEBP) và dung lượng tối đa 5MB
   * 3. Sinh S3 key an toàn `movies/posters/{uuid}-{tên file đã chuẩn hoá}`
   * 4. Gọi StorageService để lưu file, bọc lỗi lưu trữ thành lỗi nghiệp vụ
   * 5. Trả về storageKey (dùng làm posterKey khi tạo phim) và URL công khai để xem trước
   *
   * @param file - File ảnh tải lên từ Express.Multer.File
   * @returns Thông tin kết quả lưu trữ gồm storageKey, url, tên gốc, kích thước, loại file
   * @throws BadRequestException khi thiếu file, sai định dạng (MSG08) hoặc vượt quá dung lượng (MSG09)
   * @throws InternalServerErrorException khi lưu trữ thất bại (MSG10)
   */
  uploadAsset(file: Express.Multer.File): Promise<UploadMovieAssetResDto>;
}
