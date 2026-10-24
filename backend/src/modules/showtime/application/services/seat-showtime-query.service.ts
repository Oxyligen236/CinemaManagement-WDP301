import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Seat, SeatDocument } from '../../../room/domain/schemas/seat.schema';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { SeatShowtimeResDto } from '../dto/res.dto';
import { GetShowtimeSeatsUsecase } from '../usecase/get-showtime-seats.usecase';

@Injectable()
export class SeatShowtimeQueryService implements GetShowtimeSeatsUsecase {
  constructor(
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
  ) {}

  async getShowtimeSeats(showtimeId: string): Promise<SeatShowtimeResDto[]> {
    const exists = await this.showtimeModel.exists({ showtimeId });
    if (!exists) {
      throw new NotFoundException('Showtime not found');
    }

    const seatShowtimes = await this.seatShowtimeModel
      .find({ showtimeId })
      .lean()
      .exec();
    const seats = await this.seatModel
      .find({ seatId: { $in: seatShowtimes.map((s) => s.seatId) } })
      .lean()
      .exec();
    const seatById = new Map(seats.map((seat) => [seat.seatId, seat]));

    return seatShowtimes
      .flatMap((item) => {
        const seat = seatById.get(item.seatId);
        if (!seat) return [];
        const dto = new SeatShowtimeResDto();
        dto.seatShowtimeId = item.seatShowtimeId;
        dto.showtimeId = item.showtimeId;
        dto.seatId = item.seatId;
        dto.seatStatus = item.seatStatus;
        dto.rowPosition = seat.rowPosition;
        dto.columnPosition = seat.columnPosition;
        dto.seatType = seat.seatType;
        return [dto];
      })
      .sort(
        (a, b) =>
          a.rowPosition.localeCompare(b.rowPosition) ||
          a.columnPosition - b.columnPosition,
      );
  }
}
