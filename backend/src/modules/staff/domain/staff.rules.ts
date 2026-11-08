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
 * Giới hạn độ dài của từng trường, dùng chung giữa DTO và thông báo lỗi để
 * con số trong message luôn khớp với ràng buộc thực tế.
 */
export const STAFF_FIELD_LIMITS = {
  EMAIL_MAX: 254,
  /** Giới hạn của bcrypt: chuỗi dài hơn 72 byte bị cắt âm thầm khi hash. */
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72,
  NAME_MAX: 100,
  SEARCH_MAX: 100,
} as const;

/**
 * Thông báo lỗi cho từng trường của form tạo / cập nhật nhân viên (AF-1, AF-2).
 *
 * MSG01 chỉ nói "thông tin không hợp lệ" nên không đủ để người dùng biết phải
 * sửa ở đâu. Mỗi ràng buộc trong DTO phải khai báo một message tiếng Việt ở
 * đây để giao diện hiển thị đúng câu, ngay dưới đúng trường bị sai.
 */
export const STAFF_VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Vui lòng nhập email.',
  EMAIL_INVALID: 'Email không đúng định dạng.',
  EMAIL_MAX: `Email không được vượt quá ${STAFF_FIELD_LIMITS.EMAIL_MAX} ký tự.`,
  PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu tạm thời.',
  PASSWORD_MIN: `Mật khẩu tạm thời phải có tối thiểu ${STAFF_FIELD_LIMITS.PASSWORD_MIN} ký tự.`,
  PASSWORD_MAX: `Mật khẩu tạm thời không được vượt quá ${STAFF_FIELD_LIMITS.PASSWORD_MAX} ký tự.`,
  LAST_NAME_REQUIRED: 'Vui lòng nhập họ.',
  LAST_NAME_MAX: `Họ không được vượt quá ${STAFF_FIELD_LIMITS.NAME_MAX} ký tự.`,
  FIRST_NAME_REQUIRED: 'Vui lòng nhập tên.',
  FIRST_NAME_MAX: `Tên không được vượt quá ${STAFF_FIELD_LIMITS.NAME_MAX} ký tự.`,
  JOB_POSITION_REQUIRED: 'Vui lòng chọn vị trí công việc.',
  /** BR-BRM-14: Branch Manager chỉ được gán vị trí Nhân viên Bán vé. */
  JOB_POSITION_INVALID:
    'Vị trí công việc này không thuộc danh mục bạn được phép gán cho nhân viên chi nhánh.',
  EMPLOYMENT_STATUS_INVALID: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
  /** BR-BRM-14: không tạo tài khoản mới ở trạng thái đã nghỉ việc. */
  EMPLOYMENT_STATUS_NOT_CREATABLE:
    'Trạng thái khi tạo mới chỉ có thể là Đang làm việc hoặc Tạm ngưng.',
  SEARCH_MAX: `Từ khóa tìm kiếm không được vượt quá ${STAFF_FIELD_LIMITS.SEARCH_MAX} ký tự.`,
} as const;

/**
 * Thân response cho lỗi gắn với một trường cụ thể.
 *
 * Giữ nguyên `message` (câu tổng quát) và `errors` để tương thích với các màn
 * hình cũ, đồng thời bổ sung `fieldErrors` để giao diện gắn đúng câu lỗi vào
 * đúng ô nhập thay vì chỉ hiện banner chung.
 */
const staffFieldErrorBody = (
  statusCode: number,
  error: string,
  field: string,
  message: string,
) => ({
  statusCode,
  error,
  message,
  errors: [message],
  fields: [field],
  fieldErrors: { [field]: message },
});

/** Lỗi 400 của một trường cụ thể (vd. vị trí công việc ngoài danh mục). */
export const staffBadRequestBody = (field: string, message: string) =>
  staffFieldErrorBody(400, 'Bad Request', field, message);

/** Lỗi 409 của một trường cụ thể (vd. email đã có tài khoản khác dùng). */
export const staffConflictBody = (field: string, message: string) =>
  staffFieldErrorBody(409, 'Conflict', field, message);

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
