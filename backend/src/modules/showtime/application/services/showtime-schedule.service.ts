import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SeatStatus, SeatShowtimeStatus } from '@prisma/client';
import {
  SHOWTIME_ERROR_CODES,
  SHOWTIME_SCHEDULE_MESSAGES,
} from '../../domain/constants/showtime-schedule.constants';
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

  constructor(private readonly prisma: PrismaService) {}

  async hasRoomConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeShowtimeId?: string,
  ): Promise<boolean> {
    const where: any = {
      roomId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    };
    if (excludeShowtimeId) {
      where.id = { not: excludeShowtimeId };
    }
    const found = await this.prisma.showtime.findFirst({
      where,
      select: { id: true },
    });
    return found !== null;
  }

  async hasSoldTickets(showtimeId: string): Promise<boolean> {
    const found = await this.prisma.seatShowtime.findFirst({
      where: { showtimeId, seatStatus: { not: SeatShowtimeStatus.EMPTY } },
      select: { id: true },
    });
    return found !== null;
  }

  async findSoldShowtimeIds(showtimeIds: string[]): Promise<Set<string>> {
    if (showtimeIds.length === 0) {
      return new Set<string>();
    }
    const rows = await this.prisma.seatShowtime.findMany({
      where: {
        showtimeId: { in: showtimeIds },
        seatStatus: { not: SeatShowtimeStatus.EMPTY },
      },
      select: { showtimeId: true },
    });
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

      const created = await this.prisma.showtime.create({
        data: {
          movieId: input.movieId,
          roomId: input.roomId,
          startTime: input.startTime,
          endTime: input.endTime,
          basePrice: input.basePrice,
          seatPriceSelections: input.seatPriceSelections as any,
          dayPriceSelections: input.dayPriceSelections as any,
        },
      });
      createdId = created.id;

      await this.generateSeatShowtimes(created.id, input.roomId);
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
      const doc = await this.prisma.showtime.findUnique({
        where: { id: showtimeId },
      });
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
      const saved = await this.prisma.showtime.update({
        where: { id: showtimeId },
        data: {
          movieId: input.movieId,
          roomId: input.roomId,
          startTime: input.startTime,
          endTime: input.endTime,
          basePrice: input.basePrice,
          seatPriceSelections: input.seatPriceSelections as any,
          dayPriceSelections: input.dayPriceSelections as any,
        },
      });

      if (roomChanged) {
        await this.prisma.seatShowtime.deleteMany({ where: { showtimeId } });
        await this.generateSeatShowtimes(showtimeId, input.roomId);
      }
      return toShowtimeResDto(saved);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteShowtime(showtimeId: string): Promise<ShowtimeResDto> {
    try {
      const doc = await this.prisma.showtime.findUnique({
        where: { id: showtimeId },
      });
      if (!doc) {
        throw this.notFound();
      }
      if (await this.hasSoldTickets(showtimeId)) {
        throw this.sold(SHOWTIME_SCHEDULE_MESSAGES.MSG05);
      }
      const snapshot = toShowtimeResDto(doc);
      await this.prisma.seatShowtime.deleteMany({ where: { showtimeId } });
      await this.prisma.showtime.delete({ where: { id: showtimeId } });
      return snapshot;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async generateSeatShowtimes(
    showtimeId: string,
    roomId: string,
  ): Promise<void> {
    const seats = await this.prisma.seat.findMany({
      where: { roomId, status: SeatStatus.AVAILABLE },
      select: { id: true },
    });
    if (seats.length === 0) {
      return;
    }
    await this.prisma.seatShowtime.createMany({
      data: seats.map((seat) => ({
        showtimeId,
        seatId: seat.id,
        seatStatus: SeatShowtimeStatus.EMPTY,
      })),
    });
  }

  private async compensate(showtimeId: string): Promise<void> {
    try {
      await this.prisma.seatShowtime.deleteMany({ where: { showtimeId } });
      await this.prisma.showtime.delete({ where: { id: showtimeId } });
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
