import { JobPosition } from '../../user/domain/enums/job-position.enum';
import { EmploymentStatus } from '../../user/domain/enums/employment-status.enum';

/**
 * Thông báo dùng trong UC19 - Manage Branch Staff.
 * Nội dung bám theo danh mục message của tài liệu SRS; sửa tại đây nếu
 * danh mục chính thức có câu chữ khác.
 */
export const STAFF_MESSAGES = {
  /** MSG01 - thông tin không hợp lệ / thiếu trường bắt buộc (AF-1, AF-2). */
  MSG01:
    'Thông tin không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc và thử lại.',
  /** MSG26 - lưu thành công (Main flow bước 5). */
  MSG26: 'Đã lưu thông tin nhân viên thành công.',
  /** AF-3 - tài khoản đã tồn tại. */
  ACCOUNT_EXISTS: 'Email này đã được sử dụng cho một tài khoản khác.',
  /** Pre-condition 2: tài khoản Quản lý chưa được Admin phân công chi nhánh. */
  NO_BRANCH:
    'Tài khoản Quản lý của bạn chưa được phân công chi nhánh. Vui lòng liên hệ Quản trị viên để được gán chi nhánh.',
  /** Chỉ sai quyền thực sự (không phải vai trò Quản lý Chi nhánh). */
  FORBIDDEN:
    'Bạn không có quyền truy cập chức năng Quản lý Nhân viên chi nhánh.',
  BRANCH_NOT_ACTIVE:
    'Chi nhánh của bạn đang không hoạt động, không thể tạo tài khoản nhân viên mới.',
  STAFF_NOT_FOUND: 'Không tìm thấy nhân viên này trong chi nhánh của bạn.',
  SERVICE_UNAVAILABLE:
    'Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.',
} as const;

/**
 * BR-BRM-14: vị trí công việc mà Branch Manager được phép gán cho nhân viên
 * thuộc chi nhánh của mình — chỉ có Nhân viên Bán vé. Vị trí nằm ngoài danh
 * sách này → MSG01 (AF-2).
 */
export const BRANCH_ASSIGNABLE_POSITIONS: readonly JobPosition[] = [
  JobPosition.TICKET_SELLER,
];

/**
 * BR-BRM-14: trạng thái được chọn khi tạo mới. Không tạo tài khoản ở trạng
 * thái RESIGNED.
 */
export const CREATABLE_STATUSES: readonly EmploymentStatus[] = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.INACTIVE,
];

/**
 * BR-BRM-15: không xóa hồ sơ nhân viên; nghỉ việc → INACTIVE/RESIGNED.
 * Mọi trạng thái khác ACTIVE đều chặn đăng nhập.
 */
export const isLoginAllowed = (status: EmploymentStatus) =>
  status === EmploymentStatus.ACTIVE;

/**
 * isActive là nguồn quyết định quyền đăng nhập (Admin cũng có thể bật/tắt),
 * employmentStatus phân biệt INACTIVE với RESIGNED. Hàm này suy ra trạng thái
 * hiển thị nhất quán, kể cả với tài khoản STAFF cũ chưa có employmentStatus.
 */
export const resolveEmploymentStatus = (
  isActive: boolean,
  stored?: EmploymentStatus,
): EmploymentStatus => {
  if (isActive) return EmploymentStatus.ACTIVE;
  return stored === EmploymentStatus.RESIGNED
    ? EmploymentStatus.RESIGNED
    : EmploymentStatus.INACTIVE;
};
