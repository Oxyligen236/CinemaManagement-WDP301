import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
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
    if (!isValidObjectId(showtimeId)) {
      throw new NotFoundException('Showtime not found');
    }
    const stObjId = new Types.ObjectId(showtimeId);
    const exists = await this.showtimeModel.exists({ _id: stObjId });
    if (!exists) {
      throw new NotFoundException('Showtime not found');
    }

    const seatShowtimes = await this.seatShowtimeModel
      .find({ showtimeId: stObjId })
      .lean()
      .exec();

    const seatObjectIds = seatShowtimes
      .map((s) => s.seatId)
      .filter((id) => Boolean(id));

    const seats = await this.seatModel
      .find({
        _id: { $in: seatObjectIds },
      })
      .lean()
      .exec();

    const seatById = new Map<string, (typeof seats)[0]>();
    for (const seat of seats) {
      seatById.set(seat._id.toString(), seat);
    }

    return seatShowtimes
      .flatMap((item) => {
        const seat = seatById.get(item.seatId.toString());
        if (!seat) return [];
        return [
          SeatShowtimeResDto.from({
            seatShowtimeId: item._id.toString(),
            showtimeId: item.showtimeId.toString(),
            seatId: seat._id.toString(),
            seatStatus: item.seatStatus,
            rowPosition: seat.rowPosition,
            columnPosition: seat.columnPosition,
            seatType: seat.seatType,
          }),
        ];
      })
      .sort(
        (a, b) =>
          a.rowPosition.localeCompare(b.rowPosition) ||
          a.columnPosition - b.columnPosition,
      );
  }
}
