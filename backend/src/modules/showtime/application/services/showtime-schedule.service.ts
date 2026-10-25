import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Seat, SeatDocument } from '../../../room/domain/schemas/seat.schema';
import { SeatStatus } from '../../../room/domain/enums/seat-status.enum';
import {
  SHOWTIME_ERROR_CODES,
  SHOWTIME_SCHEDULE_MESSAGES,
} from '../../domain/constants/showtime-schedule.constants';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';
import { toShowtimeResDto } from '../helpers/showtime-res.mapper';
import { CheckRoomAvailabilityUsecase } from '../usecase/check-room-availability.usecase';
import { CreateShowtimeUsecase } from '../usecase/create-showtime.usecase';
import { DeleteShowtimeUsecase } from '../usecase/delete-showtime.usecase';
import { UpdateShowtimeUsecase } from '../usecase/update-showtime.usecase';

@Injectable()
export class ShowtimeScheduleService
  implements
    CreateShowtimeUsecase,
    UpdateShowtimeUsecase,
    DeleteShowtimeUsecase,
    CheckRoomAvailabilityUsecase
{
  private readonly logger = new Logger(ShowtimeScheduleService.name);

  constructor(
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
  ) {}

  async hasRoomConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeShowtimeId?: string,
  ): Promise<boolean> {
    const filter: QueryFilter<ShowtimeDocument> = {
      roomId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };
    if (excludeShowtimeId) {
      filter.showtimeId = { $ne: excludeShowtimeId };
    }
    const found = await this.showtimeModel.exists(filter).exec();
    return found !== null;
  }

  async hasSoldTickets(showtimeId: string): Promise<boolean> {
    const found = await this.seatShowtimeModel
      .exists({ showtimeId, seatStatus: { $ne: SeatShowtimeStatus.EMPTY } })
      .exec();
    return found !== null;
  }

  async findSoldShowtimeIds(showtimeIds: string[]): Promise<Set<string>> {
    if (showtimeIds.length === 0) {
      return new Set<string>();
    }
    const rows = await this.seatShowtimeModel
      .find({
        showtimeId: { $in: showtimeIds },
        seatStatus: { $ne: SeatShowtimeStatus.EMPTY },
      })
      .select('showtimeId')
      .lean()
      .exec();
    return new Set(rows.map((row) => row.showtimeId));
  }

  async createShowtime(
    input: ScheduleShowtimeInputDto,
  ): Promise<ShowtimeResDto> {
    this.assertValidRange(input);
    let createdId: string | null = null;
    try {
      if (
        await this.hasRoomConflict(input.roomId, input.startTime, input.endTime)
      ) {
        throw this.roomConflict();
      }

      const created = await this.showtimeModel.create({
        movieId: input.movieId,
        roomId: input.roomId,
        startTime: input.startTime,
        endTime: input.endTime,
        basePrice: input.basePrice,
        seatPriceSelections: input.seatPriceSelections,
        dayPriceSelections: input.dayPriceSelections,
      });
      createdId = created.showtimeId;

      await this.generateSeatShowtimes(created.showtimeId, input.roomId);
      return toShowtimeResDto(created);
    } catch (error) {
      if (createdId) {
        await this.compensate(createdId);
      }
      throw this.toHttpError(error);
    }
  }

  async updateShowtime(
    showtimeId: string,
    input: ScheduleShowtimeInputDto,
  ): Promise<ShowtimeResDto> {
    this.assertValidRange(input);
    try {
      const doc = await this.showtimeModel.findOne({ showtimeId }).exec();
      if (!doc) {
        throw this.notFound();
      }
      if (await this.hasSoldTickets(showtimeId)) {
        throw this.sold(SHOWTIME_SCHEDULE_MESSAGES.MSG04);
      }
      if (
        await this.hasRoomConflict(
          input.roomId,
          input.startTime,
          input.endTime,
          showtimeId,
        )
      ) {
        throw this.roomConflict();
      }

      const roomChanged = doc.roomId !== input.roomId;
      doc.movieId = input.movieId;
      doc.roomId = input.roomId;
      doc.startTime = input.startTime;
      doc.endTime = input.endTime;
      doc.basePrice = input.basePrice;
      doc.seatPriceSelections = input.seatPriceSelections;
      doc.dayPriceSelections = input.dayPriceSelections;
      const saved = await doc.save();

      if (roomChanged) {
        await this.seatShowtimeModel.deleteMany({ showtimeId }).exec();
        await this.generateSeatShowtimes(showtimeId, input.roomId);
      }
      return toShowtimeResDto(saved);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteShowtime(showtimeId: string): Promise<ShowtimeResDto> {
    try {
      const doc = await this.showtimeModel.findOne({ showtimeId }).exec();
      if (!doc) {
        throw this.notFound();
      }
      if (await this.hasSoldTickets(showtimeId)) {
        throw this.sold(SHOWTIME_SCHEDULE_MESSAGES.MSG05);
      }
      const snapshot = toShowtimeResDto(doc);
      await this.seatShowtimeModel.deleteMany({ showtimeId }).exec();
      await this.showtimeModel.deleteOne({ showtimeId }).exec();
      return snapshot;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async generateSeatShowtimes(
    showtimeId: string,
    roomId: string,
  ): Promise<void> {
    const seats = await this.seatModel
      .find({ roomId, status: SeatStatus.AVAILABLE })
      .select('seatId')
      .lean()
      .exec();
    if (seats.length === 0) {
      return;
    }
    await this.seatShowtimeModel.insertMany(
      seats.map((seat) => ({
        showtimeId,
        seatId: seat.seatId,
        seatStatus: SeatShowtimeStatus.EMPTY,
      })),
    );
  }

  private async compensate(showtimeId: string): Promise<void> {
    try {
      await this.seatShowtimeModel.deleteMany({ showtimeId }).exec();
      await this.showtimeModel.deleteOne({ showtimeId }).exec();
    } catch (error) {
      this.logger.error(
        `Failed to roll back showtime ${showtimeId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private assertValidRange(input: ScheduleShowtimeInputDto): void {
    if (input.endTime.getTime() <= input.startTime.getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private toHttpError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    this.logger.error(
      'Showtime scheduling failed',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException(
      SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
    );
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      SHOWTIME_SCHEDULE_MESSAGES.MSG_SHOWTIME_NOT_FOUND,
    );
  }

  private roomConflict(): ConflictException {
    return new ConflictException({
      statusCode: 409,
      message: SHOWTIME_SCHEDULE_MESSAGES.MSG03,
      error: 'Conflict',
      code: SHOWTIME_ERROR_CODES.ROOM_CONFLICT,
    });
  }

  private sold(message: string): ConflictException {
    return new ConflictException({
      statusCode: 409,
      message,
      error: 'Conflict',
      code: SHOWTIME_ERROR_CODES.SHOWTIME_SOLD,
    });
  }
}
