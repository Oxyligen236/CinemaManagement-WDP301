import { JobPosition } from '../../user/domain/enums/job-position.enum';
import { EmploymentStatus } from '../../user/domain/enums/employment-status.enum';

/**
 * Thông báo dùng trong UC19 - Manage Branch Staff.
 * Nội dung bám theo danh mục message của tài liệu SRS; sửa tại đây nếu
 * danh mục chính thức có câu chữ khác.
 */
export const STAFF_MESSAGES = {
  /** MSG01 - thông tin không hợp lệ / thiếu trường bắt buộc (AF-1, AF-2). */
  MSG01: 'Invalid information. Please check the required fields and try again.',
  /** MSG26 - lưu thành công (Main flow bước 5). */
  MSG26: 'Employee information has been saved successfully.',
  /** AF-3 - tài khoản đã tồn tại. */
  ACCOUNT_EXISTS: 'An account with this email already exists.',
  NO_BRANCH: 'Your account is not assigned to any branch.',
  BRANCH_NOT_ACTIVE:
    'Your branch is not active. New employee accounts cannot be created.',
  STAFF_NOT_FOUND: 'Employee not found in your branch.',
  SERVICE_UNAVAILABLE:
    'The service is temporarily unavailable. Please try again later.',
} as const;

/**
 * BR-BRM-14: vị trí công việc mà Branch Manager được phép gán cho nhân viên
 * thuộc chi nhánh của mình. Vị trí nằm ngoài danh sách này → MSG01 (AF-2).
 */
export const BRANCH_ASSIGNABLE_POSITIONS: readonly JobPosition[] = [
  JobPosition.TICKET_SELLER,
  JobPosition.CONCESSION_STAFF,
  JobPosition.USHER,
  JobPosition.PROJECTIONIST,
  JobPosition.CLEANER,
  JobPosition.SHIFT_SUPERVISOR,
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
