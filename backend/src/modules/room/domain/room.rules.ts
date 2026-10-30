import { RoomStatus } from './enums/room-status.enum';
import { SeatStatus } from './enums/seat-status.enum';
import { SeatShowtimeStatus } from '../../showtime/domain/enums/seat-showtime-status.enum';

/**
 * Thông báo và quy tắc nghiệp vụ cho Quản lý Phòng chiếu & Ghế của Branch Manager.
 * Bám sát quy tắc BR-BRM-05, BR-BRM-06, BR-BRM-07 và AF-1..AF-3.
 */
export const ROOM_MESSAGES = {
  /** Thiếu thông tin hoặc dữ liệu đầu vào không hợp lệ */
  MSG01_INVALID_INPUT:
    'Thông tin phòng chiếu hoặc ghế không hợp lệ. Vui lòng kiểm tra lại.',
  /** Main flow bước 5: Cập nhật thành công */
  MSG04_ROOM_UPDATED: 'Cập nhật thông tin phòng chiếu thành công.',
  MSG04_ROOM_CREATED: 'Tạo phòng chiếu mới và khởi tạo sơ đồ ghế thành công.',
  MSG04_SEATS_UPDATED: 'Cập nhật trạng thái sơ đồ ghế thành công.',
  /** AF-1 / BR-BRM-06: Chặn chuyển phòng sang Bảo trì khi còn suất chiếu sắp tới */
  MSG05_ROOM_HAS_UPCOMING_SHOWTIMES:
    'Không thể chuyển phòng chiếu sang trạng thái Bảo trì vì phòng đang có suất chiếu sắp diễn ra hoặc đang chiếu.',
  /** AF-2 / BR-BRM-07: Chặn báo hỏng ghế khi ghế đã bán vé ở suất chiếu sắp tới */
  MSG06_SEAT_SOLD_IN_UPCOMING_SHOWTIME:
    'Không thể đánh dấu ghế Hỏng/Bảo trì vì ghế này đã có khách đặt hoặc mua vé trong suất chiếu sắp tới.',
  /** Chặn thay đổi layout khi phòng có suất chiếu đã bán vé */
  MSG07_CANNOT_CHANGE_LAYOUT_WITH_BOOKED_TICKETS:
    'Không thể thay đổi sơ đồ ghế vì phòng đang có suất chiếu đã bán vé cho khách hàng. Vui lòng đợi các suất chiếu kết thúc trước khi đổi layout.',
  MSG08_LAYOUT_REPLACED:
    'Cập nhật sơ đồ bố trí ghế cho phòng chiếu thành công.',
  ROOM_NOT_FOUND: 'Không tìm thấy phòng chiếu trong chi nhánh của bạn.',
  ROOM_NAME_EXISTS: 'Tên phòng chiếu đã tồn tại trong chi nhánh.',
  SEAT_NOT_FOUND: 'Không tìm thấy ghế hợp lệ trong phòng chiếu này.',
  NO_BRANCH: 'Tài khoản Quản lý của bạn chưa được phân công chi nhánh.',
  BRANCH_NOT_ACTIVE:
    'Chi nhánh hiện không hoạt động, không thể thay đổi cấu hình phòng chiếu.',
  SERVICE_UNAVAILABLE: 'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.',
} as const;

export const ASSIGNABLE_ROOM_STATUSES: readonly RoomStatus[] = [
  RoomStatus.AVAILABLE,
  RoomStatus.MAINTENANCE,
];

export const isSeatBrokenStatus = (status: SeatStatus): boolean =>
  status === SeatStatus.MAINTENANCE || status === SeatStatus.BLOCKED;

export const LOCKED_UPCOMING_SEAT_STATUSES: readonly SeatShowtimeStatus[] = [
  SeatShowtimeStatus.BOOKED,
  SeatShowtimeStatus.RESERVED,
];
