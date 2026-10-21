/**
 * Trạng thái làm việc của nhân viên (UC19 / BR-BRM-15).
 * Nhân viên nghỉ việc không bị xóa khỏi hệ thống mà chuyển sang
 * INACTIVE hoặc RESIGNED. Chỉ ACTIVE mới được đăng nhập.
 */
export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  RESIGNED = 'RESIGNED',
}
