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
import { isValidObjectId, Model, QueryFilter, Types } from 'mongoose';
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
      roomId: isValidObjectId(roomId) ? new Types.ObjectId(roomId) : roomId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };
    if (excludeShowtimeId) {
      filter._id = {
        $ne: isValidObjectId(excludeShowtimeId)
          ? new Types.ObjectId(excludeShowtimeId)
          : excludeShowtimeId,
      };
    }
    const found = await this.showtimeModel.exists(filter).exec();
    return found !== null;
  }

  async hasSoldTickets(showtimeId: string): Promise<boolean> {
    const found = await this.seatShowtimeModel
      .exists({
        showtimeId: isValidObjectId(showtimeId)
          ? new Types.ObjectId(showtimeId)
          : showtimeId,
        seatStatus: { $ne: SeatShowtimeStatus.EMPTY },
      })
      .exec();
    return found !== null;
  }

  async findSoldShowtimeIds(showtimeIds: string[]): Promise<Set<string>> {
    if (showtimeIds.length === 0) {
      return new Set<string>();
    }
    const objectIds = showtimeIds.map((id) =>
      isValidObjectId(id) ? new Types.ObjectId(id) : (id as any),
    );
    const rows = await this.seatShowtimeModel
      .find({
        showtimeId: { $in: objectIds },
        seatStatus: { $ne: SeatShowtimeStatus.EMPTY },
      })
      .select('showtimeId')
      .lean()
      .exec();
    return new Set(rows.map((row) => row.showtimeId.toString()));
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
        movieId: isValidObjectId(input.movieId)
          ? new Types.ObjectId(input.movieId)
          : (input.movieId as any),
        roomId: isValidObjectId(input.roomId)
          ? new Types.ObjectId(input.roomId)
          : (input.roomId as any),
        startTime: input.startTime,
        endTime: input.endTime,
        basePrice: input.basePrice,
        seatPriceSelections: input.seatPriceSelections?.map((s) => ({
          seatType: s.seatType,
          ruleId: s.ruleId
            ? isValidObjectId(s.ruleId)
              ? new Types.ObjectId(s.ruleId)
              : (s.ruleId as any)
            : null,
          multiplier: s.multiplier,
        })),
        dayPriceSelections: input.dayPriceSelections?.map((s) => ({
          dayType: s.dayType,
          ruleId: s.ruleId
            ? isValidObjectId(s.ruleId)
              ? new Types.ObjectId(s.ruleId)
              : (s.ruleId as any)
            : null,
          multiplier: s.multiplier,
        })),
      });
      createdId = created._id.toString();

      await this.generateSeatShowtimes(createdId, input.roomId);
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
      if (!isValidObjectId(showtimeId)) {
        throw this.notFound();
      }
      const doc = await this.showtimeModel.findById(showtimeId).exec();
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

      const roomChanged = doc.roomId.toString() !== input.roomId;
      doc.movieId = isValidObjectId(input.movieId)
        ? new Types.ObjectId(input.movieId)
        : (input.movieId as any);
      doc.roomId = isValidObjectId(input.roomId)
        ? new Types.ObjectId(input.roomId)
        : (input.roomId as any);
      doc.startTime = input.startTime;
      doc.endTime = input.endTime;
      doc.basePrice = input.basePrice;
      doc.seatPriceSelections = (input.seatPriceSelections ?? []).map((s) => ({
        seatType: s.seatType,
        ruleId: s.ruleId
          ? isValidObjectId(s.ruleId)
            ? new Types.ObjectId(s.ruleId)
            : (s.ruleId as any)
          : null,
        multiplier: s.multiplier,
      }));
      doc.dayPriceSelections = (input.dayPriceSelections ?? []).map((s) => ({
        dayType: s.dayType,
        ruleId: s.ruleId
          ? isValidObjectId(s.ruleId)
            ? new Types.ObjectId(s.ruleId)
            : (s.ruleId as any)
          : null,
        multiplier: s.multiplier,
      }));
      const saved = await doc.save();

      if (roomChanged) {
        const stObjId = new Types.ObjectId(showtimeId);
        await this.seatShowtimeModel.deleteMany({ showtimeId: stObjId }).exec();
        await this.generateSeatShowtimes(showtimeId, input.roomId);
      }
      return toShowtimeResDto(saved);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteShowtime(showtimeId: string): Promise<ShowtimeResDto> {
    try {
      if (!isValidObjectId(showtimeId)) {
        throw this.notFound();
      }
      const doc = await this.showtimeModel.findById(showtimeId).exec();
      if (!doc) {
        throw this.notFound();
      }
      if (await this.hasSoldTickets(showtimeId)) {
        throw this.sold(SHOWTIME_SCHEDULE_MESSAGES.MSG05);
      }
      const snapshot = toShowtimeResDto(doc);
      const stObjId = new Types.ObjectId(showtimeId);
      await this.seatShowtimeModel.deleteMany({ showtimeId: stObjId }).exec();
      await this.showtimeModel.findByIdAndDelete(stObjId).exec();
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
      .find({
        roomId: isValidObjectId(roomId)
          ? new Types.ObjectId(roomId)
          : (roomId as any),
        status: SeatStatus.AVAILABLE,
      })
      .select('_id')
      .lean()
      .exec();
    if (seats.length === 0) {
      return;
    }
    const stObjId = isValidObjectId(showtimeId)
      ? new Types.ObjectId(showtimeId)
      : (showtimeId as any);
    await this.seatShowtimeModel.insertMany(
      seats.map((seat) => ({
        showtimeId: stObjId,
        seatId: seat._id,
        seatStatus: SeatShowtimeStatus.EMPTY,
      })),
    );
  }

  private async compensate(showtimeId: string): Promise<void> {
    try {
      const stObjId = isValidObjectId(showtimeId)
        ? new Types.ObjectId(showtimeId)
        : (showtimeId as any);
      await this.seatShowtimeModel
        .deleteMany({
          showtimeId: stObjId,
        })
        .exec();
      await this.showtimeModel.findByIdAndDelete(stObjId).exec();
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
