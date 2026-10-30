import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
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
    const seatShowtime = isValidObjectId(seatShowtimeId)
      ? await this.seatShowtimeModel.findById(seatShowtimeId).lean().exec()
      : null;
    if (!seatShowtime) return null;

    const [showtime, seat] = await Promise.all([
      this.showtimeModel.findById(seatShowtime.showtimeId).lean().exec(),
      this.seatModel.findById(seatShowtime.seatId).lean().exec(),
    ]);
    if (!showtime || !seat) return null;

    const [movie, room] = await Promise.all([
      this.movieModel.findById(showtime.movieId).lean().exec(),
      this.roomModel.findById(showtime.roomId).lean().exec(),
    ]);
    if (!movie || !room) return null;

    const branch = await this.branchModel.findById(room.branchId).lean().exec();

    return {
      seatShowtimeId: seatShowtime._id.toString(),
      showtimeId: showtime._id.toString(),
      movieId: movie._id.toString(),
      movieTitle: movie.movieName,
      roomId: room._id.toString(),
      roomName: room.roomName,
      seatId: seat._id.toString(),
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      price: showtime.basePrice,
      startTime: showtime.startTime,
      endTime: showtime.endTime,
      branchId: room.branchId?.toString() ?? '',
      branchName: branch?.branchName ?? '',
      branchAddress: branch?.address,
    };
  }
}
