import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Page } from '../../../../common/dto/page.dto';
import type { MovieSchedulingInfoResDto } from '../../../movie/application/dto/res.dto';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import type { PriceSelectionInputDto } from '../../../pricerule/application/dto/req.dto';
import { PriceRuleOptionQueryService } from '../../../pricerule/application/services/price-rule-option-query.service';
import type { RoomOptionResDto } from '../../../room/application/dto/res.dto';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import type { ShowtimeResDto } from '../../../showtime/application/dto/res.dto';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import { ShowtimeScheduleService } from '../../../showtime/application/services/showtime-schedule.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import {
  DEFAULT_BASE_PRICE,
  MOVIE_STATUS_ENDED,
  MSG02,
  MSG04,
  MSG05,
  MSG_CODE_SHOWTIME_SOLD,
  MSG_INVALID_MOVIE,
  MSG_INVALID_ROOM,
  MSG_LOAD_FAILED,
  MSG_NOT_FOUND,
  MSG_PAST_START,
  MSG_ROOM_NOT_ACTIVE,
  MSG_SAVE_FAILED,
  ROOM_STATUS_AVAILABLE,
} from '../../domain/constants/showtime-management.constants';
import {
  SaveShowtimeReqDto,
  SearchManagedShowtimeReqDto,
} from '../dto/req.dto';
import { ManagedShowtimeResDto, ShowtimeMutationResDto } from '../dto/res.dto';
import {
  fieldValidationException,
  requireBranchId,
  toHttpError,
} from '../helpers/showtime-management-validation.helper';
import type { PreparedShowtime } from '../helpers/prepared-showtime.type';
import {
  addMinutes,
  startOfTodayVnUtc,
  toUtcDate,
  vnDayRangeUtc,
} from '../helpers/showtime-time.helper';
import { CreateManagedShowtimeUsecase } from '../usecase/create-managed-showtime.usecase';
import { DeleteManagedShowtimeUsecase } from '../usecase/delete-managed-showtime.usecase';
import { ListManagedShowtimesUsecase } from '../usecase/list-managed-showtimes.usecase';
import { UpdateManagedShowtimeUsecase } from '../usecase/update-managed-showtime.usecase';

@Injectable()
export class ManagedShowtimeService
  implements
    ListManagedShowtimesUsecase,
    CreateManagedShowtimeUsecase,
    UpdateManagedShowtimeUsecase,
    DeleteManagedShowtimeUsecase
{
  private readonly logger = new Logger(ManagedShowtimeService.name);

  constructor(
    private readonly userBranchQuery: UserBranchQueryService,
    private readonly movieOptionQuery: MovieOptionQueryService,
    private readonly roomOptionQuery: RoomOptionQueryService,
    private readonly showtimeQuery: ShowtimeQueryService,
    private readonly showtimeSchedule: ShowtimeScheduleService,
    private readonly priceRuleOptionQuery: PriceRuleOptionQueryService,
  ) {}

  async listShowtimes(
    userId: string,
    query: SearchManagedShowtimeReqDto,
  ): Promise<Page<ManagedShowtimeResDto>> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);
      const roomIds = rooms.map((room) => room.roomId);
      if (query.roomId && !roomIds.includes(query.roomId)) {
        return Page.from([], 0, page, limit);
      }

      let from: Date | undefined;
      let to: Date | undefined;
      if (query.date) {
        ({ from, to } = vnDayRangeUtc(query.date));
      } else if (!query.includePast) {
        from = startOfTodayVnUtc(new Date());
      }

      const result = await this.showtimeQuery.searchShowtimesByRooms(
        roomIds,
        { movieId: query.movieId, roomId: query.roomId, from, to },
        page,
        limit,
      );
      if (result.items.length === 0) {
        return Page.from([], result.total, result.page, result.limit);
      }

      const [movies, soldIds] = await Promise.all([
        this.movieOptionQuery.getMovieSchedulingInfos([
          ...new Set(result.items.map((item) => item.movieId)),
        ]),
        this.showtimeSchedule.findSoldShowtimeIds(
          result.items.map((item) => item.showtimeId),
        ),
      ]);
      const movieById = new Map(movies.map((movie) => [movie.movieId, movie]));
      const roomById = new Map(rooms.map((room) => [room.roomId, room]));

      const items = result.items.map((item) =>
        this.toManagedShowtime(
          item,
          movieById.get(item.movieId) ?? null,
          roomById.get(item.roomId) ?? null,
          soldIds.has(item.showtimeId),
        ),
      );
      return Page.from(items, result.total, result.page, result.limit);
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_LOAD_FAILED);
    }
  }

  async getShowtime(
    userId: string,
    showtimeId: string,
  ): Promise<ManagedShowtimeResDto> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const { showtime, room } = await this.loadOwnedShowtime(
        branchId,
        showtimeId,
      );
      const [movie, sold] = await Promise.all([
        this.movieOptionQuery.getMovieSchedulingInfo(showtime.movieId),
        this.showtimeSchedule.hasSoldTickets(showtime.showtimeId),
      ]);
      return this.toManagedShowtime(showtime, movie, room, sold);
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_LOAD_FAILED);
    }
  }

  async createShowtime(
    userId: string,
    body: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const { input, movie, room } = await this.prepareShowtime(branchId, body);
      const created = await this.showtimeSchedule.createShowtime(input);
      return {
        message: MSG02,
        showtime: this.toManagedShowtime(created, movie, room, false),
      };
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_SAVE_FAILED);
    }
  }

  async updateShowtime(
    userId: string,
    showtimeId: string,
    body: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const { showtime: current } = await this.loadOwnedShowtime(
        branchId,
        showtimeId,
      );
      await this.assertNotSold(showtimeId, MSG04);

      const { input, movie, room } = await this.prepareShowtime(
        branchId,
        body,
        current,
      );
      // ShowtimeScheduleService kiểm tra chồng lấn loại trừ chính suất này (MSG03)
      const updated = await this.showtimeSchedule.updateShowtime(
        showtimeId,
        input,
      );
      return {
        message: MSG02,
        showtime: this.toManagedShowtime(updated, movie, room, false),
      };
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_SAVE_FAILED);
    }
  }

  async deleteShowtime(
    userId: string,
    showtimeId: string,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await requireBranchId(this.userBranchQuery, userId);
      const { showtime: current, room } = await this.loadOwnedShowtime(
        branchId,
        showtimeId,
      );
      await this.assertNotSold(showtimeId, MSG05);
      // Tra phim trước khi xóa để lỗi tra cứu không xảy ra sau khi dữ liệu đã bị xóa
      const movie = await this.movieOptionQuery.getMovieSchedulingInfo(
        current.movieId,
      );

      const deleted = await this.showtimeSchedule.deleteShowtime(showtimeId);
      return {
        message: MSG02,
        showtime: this.toManagedShowtime(deleted, movie, room, false),
      };
    } catch (error) {
      throw toHttpError(this.logger, error, MSG_SAVE_FAILED);
    }
  }

  /** Suất tồn tại và phòng của nó thuộc chi nhánh; ngược lại 404 (không lộ tồn tại). */
  private async loadOwnedShowtime(
    branchId: string,
    showtimeId: string,
  ): Promise<{ showtime: ShowtimeResDto; room: RoomOptionResDto }> {
    let showtime: ShowtimeResDto;
    try {
      showtime = await this.showtimeQuery.getShowtimeDetail(showtimeId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(MSG_NOT_FOUND);
      }
      throw error;
    }
    const room = await this.roomOptionQuery.getRoomSchedulingInfo(
      showtime.roomId,
    );
    if (!room || room.branchId !== branchId) {
      throw new NotFoundException(MSG_NOT_FOUND);
    }
    return { showtime, room };
  }

  /** BR-BRM-03: suất đã bán vé (BOOKED/RESERVED) không được sửa/xóa. */
  private async assertNotSold(
    showtimeId: string,
    message: string,
  ): Promise<void> {
    if (await this.showtimeSchedule.hasSoldTickets(showtimeId)) {
      throw new ConflictException({
        statusCode: 409,
        message,
        error: 'Conflict',
        code: MSG_CODE_SHOWTIME_SOLD,
      });
    }
  }

  /**
   * Kiểm tra phim, phòng, giờ, hệ số theo thứ tự plan 2.1 rồi dựng dữ liệu ghi.
   * `current` có mặt khi sửa: giữ giá/snapshot cũ nếu request không gửi, bỏ qua kiểm tra quá khứ nếu giờ/phòng không đổi.
   */
  private async prepareShowtime(
    branchId: string,
    body: SaveShowtimeReqDto,
    current?: ShowtimeResDto,
  ): Promise<PreparedShowtime> {
    const movie = await this.movieOptionQuery.getMovieSchedulingInfo(
      body.movieId,
    );
    if (!movie || !movie.isActive || movie.status === MOVIE_STATUS_ENDED) {
      throw fieldValidationException('movieId', MSG_INVALID_MOVIE);
    }

    const room = await this.roomOptionQuery.getRoomSchedulingInfo(body.roomId);
    if (!room || room.branchId !== branchId) {
      throw fieldValidationException('roomId', MSG_INVALID_ROOM);
    }
    if (room.roomStatus !== ROOM_STATUS_AVAILABLE) {
      throw fieldValidationException('roomId', MSG_ROOM_NOT_ACTIVE);
    }

    const startTime = toUtcDate(body.screeningDate, body.startTime);
    const endTime = addMinutes(startTime, movie.duration);
    const timeOrRoomChanged =
      !current ||
      current.startTime.getTime() !== startTime.getTime() ||
      current.roomId !== room.roomId;
    if (timeOrRoomChanged && startTime.getTime() <= Date.now()) {
      throw fieldValidationException('startTime', MSG_PAST_START);
    }

    let seatPriceSelections = current?.seatPriceSelections ?? [];
    let dayPriceSelections = current?.dayPriceSelections ?? [];
    if (!current || body.priceSelections !== undefined) {
      const resolved = await this.priceRuleOptionQuery.resolvePriceSelections(
        (body.priceSelections ?? []).map((selection) => ({
          group: selection.group as PriceSelectionInputDto['group'],
          fieldKey: selection.fieldKey,
          ruleId: selection.ruleId,
        })),
      );
      seatPriceSelections = resolved.seatPriceSelections;
      dayPriceSelections = resolved.dayPriceSelections;
    }

    return {
      movie,
      room,
      input: {
        movieId: movie.movieId,
        roomId: room.roomId,
        startTime,
        endTime,
        basePrice: body.basePrice ?? current?.basePrice ?? DEFAULT_BASE_PRICE,
        seatPriceSelections,
        dayPriceSelections,
      },
    };
  }

  private toManagedShowtime(
    showtime: ShowtimeResDto,
    movie: Pick<
      MovieSchedulingInfoResDto,
      'movieName' | 'duration' | 'posterUrl'
    > | null,
    room: Pick<RoomOptionResDto, 'roomName'> | null,
    hasSoldTickets: boolean,
  ): ManagedShowtimeResDto {
    const dto = new ManagedShowtimeResDto();
    dto.showtimeId = showtime.showtimeId;
    dto.movieId = showtime.movieId;
    dto.movieName = movie?.movieName ?? '';
    dto.movieDuration =
      movie?.duration ??
      Math.round(
        (showtime.endTime.getTime() - showtime.startTime.getTime()) / 60_000,
      );
    dto.posterUrl = movie?.posterUrl;
    dto.roomId = showtime.roomId;
    dto.roomName = room?.roomName ?? '';
    dto.startTime = showtime.startTime;
    dto.endTime = showtime.endTime;
    dto.basePrice = showtime.basePrice;
    dto.seatPriceSelections = (showtime.seatPriceSelections ?? []).map(
      (selection) => ({ ...selection }),
    );
    dto.dayPriceSelections = (showtime.dayPriceSelections ?? []).map(
      (selection) => ({ ...selection }),
    );
    dto.hasSoldTickets = hasSoldTickets;
    return dto;
  }
}
