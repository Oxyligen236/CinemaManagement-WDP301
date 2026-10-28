import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../domain/schemas/seat-showtime.schema';
import { Showtime, ShowtimeDocument } from '../domain/schemas/showtime.schema';
import { Movie, MovieDocument } from '../../movie/domain/schemas/movie.schema';
import { Room, RoomDocument } from '../../room/domain/schemas/room.schema';
import { Seat, SeatDocument } from '../../room/domain/schemas/seat.schema';
import {
  Branch,
  BranchDocument,
} from '../../branch/domain/schemas/branch.schema';
import { SeatShowtimeDetailDto, ShowtimeContract } from './showtime.contract';

@Injectable()
export class ShowtimeContractImpl implements ShowtimeContract {
  constructor(
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(Movie.name) private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Seat.name) private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getSeatShowtimeDetail(
    seatShowtimeId: string,
  ): Promise<SeatShowtimeDetailDto | null> {
    const seatShowtime = await this.seatShowtimeModel
      .findOne({ seatShowtimeId })
      .lean()
      .exec();
    if (!seatShowtime) return null;
    const [showtime, seat] = await Promise.all([
      this.showtimeModel
        .findOne({ showtimeId: seatShowtime.showtimeId })
        .lean()
        .exec(),
      this.seatModel.findOne({ seatId: seatShowtime.seatId }).lean().exec(),
    ]);
    if (!showtime || !seat) return null;
    const [movie, room] = await Promise.all([
      this.movieModel.findOne({ movieId: showtime.movieId }).lean().exec(),
      this.roomModel.findOne({ roomId: showtime.roomId }).lean().exec(),
    ]);
    if (!movie || !room) return null;
    const branch = await this.branchModel
      .findOne({ branchId: room.branchId })
      .lean()
      .exec();
    return {
      seatShowtimeId: seatShowtime.seatShowtimeId,
      showtimeId: showtime.showtimeId,
      movieId: showtime.movieId,
      movieTitle: movie.movieName,
      roomId: room.roomId,
      roomName: room.roomName,
      seatId: seat.seatId,
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      price: showtime.basePrice,
      startTime: showtime.startTime,
      endTime: showtime.endTime,
      branchId: room.branchId,
      branchName: branch?.branchName ?? '',
      branchAddress: branch?.address,
    };
  }
}
