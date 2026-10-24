import type { MovieSchedulingInfoResDto } from '../../../movie/application/dto/res.dto';
import type { RoomOptionResDto } from '../../../room/application/dto/res.dto';
import type { ScheduleShowtimeInputDto } from '../../../showtime/application/dto/req.dto';

/** Dữ liệu đã kiểm tra hợp lệ, sẵn sàng ghi suất chiếu. */
export interface PreparedShowtime {
  input: ScheduleShowtimeInputDto;
  movie: MovieSchedulingInfoResDto;
  room: RoomOptionResDto;
}
