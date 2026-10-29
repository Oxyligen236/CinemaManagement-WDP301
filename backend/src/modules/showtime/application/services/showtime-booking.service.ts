import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  Movie,
  MovieDocument,
} from '../../../movie/domain/schemas/movie.schema';
import { Room, RoomDocument } from '../../../room/domain/schemas/room.schema';
import { Seat, SeatDocument } from '../../../room/domain/schemas/seat.schema';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { SeatBookingDetail } from '../../contract/seat-booking-detail';
import { ConfirmShowtimeSeatsUsecase } from '../usecase/confirm-showtime-seats.usecase';
import { SEAT_BOOKING_MESSAGES } from '../../domain/showtime.rules';

@Injectable()
export class ShowtimeBookingService implements ConfirmShowtimeSeatsUsecase {
  constructor(
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(Seat.name) private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
  ) {}

  /**
   * Giữ toàn bộ ghế cho một đơn đặt vé.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra danh sách và xác nhận ghế EMPTY thuộc cùng suất chiếu.
   * 2. Reserve từng ghế có điều kiện; rollback nếu có xung đột.
   *
   * @param seatShowtimeIds - IDs ghế suất chiếu cần giữ
   * @returns Chi tiết ghế đã reserve
   * @throws ConflictException khi ghế không khả dụng hoặc khác suất chiếu
   */
  async reserveSeats(seatShowtimeIds: string[]): Promise<SeatBookingDetail[]> {
    if (
      !seatShowtimeIds.length ||
      new Set(seatShowtimeIds).size !== seatShowtimeIds.length
    ) {
      throw new ConflictException(SEAT_BOOKING_MESSAGES.DUPLICATED_SEATS);
    }

    const seats = await this.seatShowtimeModel
      .find({ seatShowtimeId: { $in: seatShowtimeIds } })
      .lean()
      .exec();
    if (
      seats.length !== seatShowtimeIds.length ||
      seats.some((seat) => seat.seatStatus !== SeatShowtimeStatus.EMPTY) ||
      new Set(seats.map((seat) => seat.showtimeId)).size !== 1
    ) {
      throw new ConflictException(SEAT_BOOKING_MESSAGES.SEATS_UNAVAILABLE);
    }

    const showtimeId = seats[0].showtimeId;
    const reserved: string[] = [];
    try {
      for (const id of seatShowtimeIds) {
        const result = await this.seatShowtimeModel
          .updateOne(
            {
              seatShowtimeId: id,
              showtimeId,
              seatStatus: SeatShowtimeStatus.EMPTY,
            },
            { $set: { seatStatus: SeatShowtimeStatus.RESERVED } },
          )
          .exec();
        if (result.modifiedCount !== 1)
          throw new ConflictException(
            SEAT_BOOKING_MESSAGES.SEAT_NO_LONGER_AVAILABLE,
          );
        reserved.push(id);
      }
      return await this.getSeatBookingDetails(seatShowtimeIds);
    } catch (error) {
      if (reserved.length) {
        await this.seatShowtimeModel
          .updateMany(
            {
              seatShowtimeId: { $in: reserved },
              showtimeId,
              seatStatus: SeatShowtimeStatus.RESERVED,
            },
            { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
          )
          .exec();
      }
      throw error;
    }
  }

  /**
   * Thả các ghế đang được giữ, không thay đổi ghế đã BOOKED.
   *
   * Quy trình nghiệp vụ:
   * 1. Cập nhật có điều kiện RESERVED thành EMPTY.
   * 2. Trả số ghế thực sự được cập nhật.
   *
   * @param seatShowtimeIds - IDs ghế cần thả
   * @returns Số ghế được release
   * @throws Error khi cập nhật cơ sở dữ liệu thất bại
   */
  async releaseSeats(seatShowtimeIds: string[]): Promise<number> {
    if (!seatShowtimeIds.length) return 0;
    const result = await this.seatShowtimeModel
      .updateMany(
        {
          seatShowtimeId: { $in: seatShowtimeIds },
          seatStatus: SeatShowtimeStatus.RESERVED,
        },
        { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
      )
      .exec();
    return result.modifiedCount;
  }

  /**
   * Chuyển các ghế thuộc suất chiếu từ RESERVED sang BOOKED.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra danh sách ghế đầu vào không rỗng.
   * 2. Thực hiện cập nhật nguyên tử có điều kiện seatStatus: RESERVED -> BOOKED.
   * 3. Trả về số lượng ghế đã được chuyển trạng thái.
   *
   * @param seatShowtimeIds - Danh sách mã ghế suất chiếu cần khóa
   * @returns Số lượng ghế thực tế đã chuyển sang BOOKED
   * @throws ConflictException khi số ghế cập nhật không khớp số lượng yêu cầu
   */
  async confirmSeats(
    seatShowtimeIds: string[],
    session?: ClientSession,
  ): Promise<number> {
    if (!seatShowtimeIds.length) return 0;
    const result = await this.seatShowtimeModel
      .updateMany(
        {
          seatShowtimeId: { $in: seatShowtimeIds },
          seatStatus: SeatShowtimeStatus.RESERVED,
        },
        { $set: { seatStatus: SeatShowtimeStatus.BOOKED } },
        ...(session ? [{ session }] : []),
      )
      .exec();
    if (result.modifiedCount !== seatShowtimeIds.length) {
      throw new ConflictException(
        'Một số ghế không ở trạng thái giữ chỗ để có thể hoàn tất đặt vé',
      );
    }
    return result.modifiedCount;
  }

  /**
   * Tra cứu dữ liệu ghế và thông tin suất chiếu liên quan.
   *
   * Quy trình nghiệp vụ:
   * 1. Tải ghế, suất chiếu, ghế vật lý, phòng và phim theo IDs liên kết.
   * 2. Ghép dữ liệu và báo lỗi nếu thiếu bất kỳ quan hệ bắt buộc nào.
   *
   * @param seatShowtimeIds - IDs ghế suất chiếu cần tra cứu
   * @returns Chi tiết ghế booking
   * @throws NotFoundException khi ID hoặc dữ liệu liên kết không tồn tại
   */
  async getSeatBookingDetails(
    seatShowtimeIds: string[],
  ): Promise<SeatBookingDetail[]> {
    const seatShowtimes = await this.seatShowtimeModel
      .find({ seatShowtimeId: { $in: seatShowtimeIds } })
      .lean()
      .exec();
    if (seatShowtimes.length !== new Set(seatShowtimeIds).size)
      throw new NotFoundException('Seat showtime not found');
    const showtimeIds = [
      ...new Set(seatShowtimes.map((item) => item.showtimeId)),
    ];
    const showtimes = await this.showtimeModel
      .find({ showtimeId: { $in: showtimeIds } })
      .lean()
      .exec();
    const physicalSeats = await this.seatModel
      .find({ seatId: { $in: seatShowtimes.map((item) => item.seatId) } })
      .lean()
      .exec();
    const rooms = await this.roomModel
      .find({ roomId: { $in: showtimes.map((item) => item.roomId) } })
      .lean()
      .exec();
    const movies = await this.movieModel
      .find({ movieId: { $in: showtimes.map((item) => item.movieId) } })
      .lean()
      .exec();
    const showtimeById = new Map(
      showtimes.map((item) => [item.showtimeId, item]),
    );
    const seatById = new Map(physicalSeats.map((item) => [item.seatId, item]));
    const roomById = new Map(rooms.map((item) => [item.roomId, item]));
    const movieById = new Map(movies.map((item) => [item.movieId, item]));

    return seatShowtimes
      .map((item) => {
        const showtime = showtimeById.get(item.showtimeId);
        const seat = seatById.get(item.seatId);
        const room = showtime && roomById.get(showtime.roomId);
        const movie = showtime && movieById.get(showtime.movieId);
        if (!showtime || !seat || !room || !movie)
          throw new NotFoundException('Seat booking details are incomplete');
        return {
          seatShowtimeId: item.seatShowtimeId,
          showtimeId: item.showtimeId,
          seatId: item.seatId,
          rowPosition: seat.rowPosition,
          columnPosition: seat.columnPosition,
          seatType: seat.seatType,
          seatStatus: item.seatStatus,
          basePrice: showtime.basePrice,
          startTime: showtime.startTime,
          endTime: showtime.endTime,
          roomId: room.roomId,
          roomName: room.roomName,
          branchId: room.branchId,
          movieId: movie.movieId,
          movieName: movie.movieName,
        };
      })
      .sort(
        (a, b) =>
          seatShowtimeIds.indexOf(a.seatShowtimeId) -
          seatShowtimeIds.indexOf(b.seatShowtimeId),
      );
  }
}
