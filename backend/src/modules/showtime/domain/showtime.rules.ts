import { RoomStatus } from '../../room/domain/enums/room-status.enum';
import { SeatShowtimeStatus } from './enums/seat-showtime-status.enum';

/**
 * Thông báo và quy tắc nghiệp vụ cho Quản lý Suất chiếu của Branch Manager.
 * Bám sát quy tắc BR-BRM-01, BR-BRM-02, BR-BRM-03, BR-BRM-04 và AF-1..AF-3.
 */
export const SHOWTIME_MESSAGES = {
  /** AF-1: Thiếu thông tin bắt buộc hoặc định dạng không hợp lệ. */
  MSG01: 'Vui lòng nhập đầy đủ và hợp lệ các thông tin bắt buộc.',
  /** Main flow bước 6: Thao tác thành công. */
  MSG02_CREATE: 'Tạo suất chiếu mới thành công.',
  MSG02_UPDATE: 'Cập nhật suất chiếu thành công.',
  MSG02_DELETE: 'Xóa suất chiếu thành công.',
  /** AF-2 / BR-BRM-01: Phòng chiếu bị trùng khung giờ. */
  MSG03_CONFLICT:
    'Phòng chiếu đã có suất chiếu khác trùng trong khung giờ này. Vui lòng chọn phòng chiếu hoặc khung giờ khác.',
  /** AF-3 / BR-BRM-03: Không cho phép cập nhật/xóa suất chiếu đã có vé bán. */
  MSG04_UPDATE_LOCKED:
    'Không thể cập nhật suất chiếu đã có khách đặt hoặc mua vé.',
  MSG05_DELETE_LOCKED: 'Không thể xóa suất chiếu đã có khách đặt hoặc mua vé.',
  /** Chặn thao tác với suất chiếu trong quá khứ hoặc đã bắt đầu chiếu. */
  PAST_START_TIME:
    'Thời gian bắt đầu suất chiếu phải lớn hơn thời điểm hiện tại.',
  PAST_SHOWTIME_UPDATE_LOCKED:
    'Không thể chỉnh sửa suất chiếu đã bắt đầu hoặc đã kết thúc.',
  PAST_SHOWTIME_DELETE_LOCKED:
    'Không thể xóa suất chiếu đã bắt đầu hoặc đã kết thúc.',
  /** BR-BRM-04: Phòng chiếu phải thuộc chi nhánh và ở trạng thái AVAILABLE. */
  ROOM_NOT_FOUND: 'Không tìm thấy phòng chiếu trong chi nhánh của bạn.',
  ROOM_NOT_AVAILABLE:
    'Chỉ có thể xếp suất chiếu cho phòng chiếu đang hoạt động (Active).',
  MOVIE_NOT_FOUND: 'Không tìm thấy bộ phim hoặc phim đã ngừng chiếu.',
  SHOWTIME_NOT_FOUND: 'Không tìm thấy suất chiếu trong chi nhánh của bạn.',
  NO_BRANCH: 'Tài khoản Quản lý của bạn chưa được phân công chi nhánh.',
  BRANCH_NOT_ACTIVE:
    'Chi nhánh hiện không hoạt động, không thể thay đổi lịch chiếu.',
  SERVICE_UNAVAILABLE: 'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.',
} as const;

/**
 * Thông báo cho luồng giữ ghế khi đặt vé (khách online và quầy POS).
 *
 * Viết bằng tiếng Việt vì được trả thẳng cho client: nếu để tiếng Anh, frontend
 * không nhận ra đây là thông báo nghiệp vụ và sẽ thay bằng câu chung chung,
 * khiến người dùng không biết phải chọn lại ghế.
 */
export const SEAT_BOOKING_MESSAGES = {
  DUPLICATED_SEATS: 'Danh sách ghế bị trùng, vui lòng chọn lại.',
  SEATS_UNAVAILABLE:
    'Một số ghế bạn chọn vừa có người giữ hoặc đã được đặt, vui lòng chọn ghế khác.',
  SEAT_NO_LONGER_AVAILABLE:
    'Ghế này vừa có người giữ hoặc đã được đặt, vui lòng chọn ghế khác.',
} as const;

/**
 * BR-BRM-02: Tính thời gian kết thúc dựa trên thời lượng phim (phút).
 */
export const calculateShowtimeEndTime = (
  startTime: Date,
  durationMinutes: number,
): Date => {
  return new Date(startTime.getTime() + durationMinutes * 60 * 1000);
};

/**
 * BR-BRM-04: Kiểm tra phòng chiếu có đủ điều kiện gán suất chiếu không.
 */
export const isRoomAssignable = (status: RoomStatus): boolean =>
  status === RoomStatus.AVAILABLE;

/**
 * BR-BRM-03: Các trạng thái ghế xác định suất chiếu đã có giao dịch vé/giữ chỗ.
 */
export const LOCKED_SEAT_SHOWTIME_STATUSES: readonly SeatShowtimeStatus[] = [
  SeatShowtimeStatus.BOOKED,
  SeatShowtimeStatus.RESERVED,
];
