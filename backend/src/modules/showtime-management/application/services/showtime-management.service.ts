import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Page } from '../../../../common/dto/page.dto';
import { AuthenticatedUser } from '../../../auth/domain/types/authenticated-user.type';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { MovieStatus } from '../../../movie/domain/enums/movie-status.enum';
import { MovieOptionResDto } from '../../../movie/application/dto/res.dto';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import { PriceRuleOptionQueryService } from '../../../pricerule/application/services/price-rule-option-query.service';
import { RoomStatus } from '../../../room/domain/enums/room-status.enum';
import { RoomOptionResDto } from '../../../room/application/dto/res.dto';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import {
  SHOWTIME_ERROR_CODES,
  SHOWTIME_SCHEDULE_MESSAGES,
} from '../../../showtime/domain/constants/showtime-schedule.constants';
import {
  ScheduleDaySelectionDto,
  ScheduleSeatSelectionDto,
  ScheduleShowtimeInputDto,
} from '../../../showtime/application/dto/req.dto';
import { ShowtimeResDto } from '../../../showtime/application/dto/res.dto';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import { ShowtimeScheduleService } from '../../../showtime/application/services/showtime-schedule.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import {
  CODE_SHOWTIME_STARTED,
  DEFAULT_BASE_PRICE,
  MSG02,
  MSG_INVALID_DATE,
  MSG_INVALID_MOVIE,
  MSG_INVALID_ROOM,
  MSG_LOAD_FAILED,
  MSG_NOT_FOUND,
  MSG_NO_BRANCH,
  MSG_PAST_START,
  MSG_ROOM_NOT_ACTIVE,
  MSG_SAVE_FAILED,
  MSG_STARTED_DELETE,
  MSG_STARTED_EDIT,
} from '../../domain/constants/showtime-management.constants';
import { buildShowtimeValidationException } from '../../infra/save-showtime-validation.exception-factory';
import {
  MovieOptionSearchReqDto,
  SaveShowtimeReqDto,
  SearchManagedShowtimeReqDto,
} from '../dto/req.dto';
import {
  ManagedShowtimeResDto,
  ManagerContextResDto,
  ShowtimeMutationResDto,
} from '../dto/res.dto';
import {
  addMinutes,
  startOfTodayVnUtc,
  toUtcDate,
  vnDayRangeUtc,
} from '../helpers/showtime-time.helper';

type MovieInfo = {
  movieName: string;
  duration: number;
  posterUrl?: string;
};

@Injectable()
export class ShowtimeManagementService {
  private readonly logger = new Logger(ShowtimeManagementService.name);

  constructor(
    private readonly userBranchQuery: UserBranchQueryService,
    private readonly branchQuery: BranchQueryService,
    private readonly movieOptionQuery: MovieOptionQueryService,
    private readonly roomOptionQuery: RoomOptionQueryService,
    private readonly showtimeQuery: ShowtimeQueryService,
    private readonly scheduleService: ShowtimeScheduleService,
    private readonly priceRuleQuery: PriceRuleOptionQueryService,
  ) {}

  async getContext(
    user: AuthenticatedUser | undefined,
  ): Promise<ManagerContextResDto> {
    try {
      const branchId = await this.resolveBranchId(user);
      const branch = await this.branchQuery.getBranchSummary(branchId);
      if (!branch) {
        throw new ForbiddenException(MSG_NO_BRANCH);
      }
      return { branchId: branch.branchId, branchName: branch.branchName };
    } catch (error) {
      this.fail(error, MSG_LOAD_FAILED);
    }
  }

  async searchMovieOptions(
    user: AuthenticatedUser | undefined,
    query: MovieOptionSearchReqDto,
  ): Promise<Page<MovieOptionResDto>> {
    try {
      await this.resolveBranchId(user);
      return await this.movieOptionQuery.searchMovieOptions(
        query.keyword,
        query.page,
        query.limit,
      );
    } catch (error) {
      this.fail(error, MSG_LOAD_FAILED);
    }
  }

  async listRoomOptions(
    user: AuthenticatedUser | undefined,
  ): Promise<RoomOptionResDto[]> {
    try {
      const branchId = await this.resolveBranchId(user);
      return await this.roomOptionQuery.listRoomsByBranch(branchId);
    } catch (error) {
      this.fail(error, MSG_LOAD_FAILED);
    }
  }

  async listShowtimes(
    user: AuthenticatedUser | undefined,
    query: SearchManagedShowtimeReqDto,
  ): Promise<Page<ManagedShowtimeResDto>> {
    try {
      const branchId = await this.resolveBranchId(user);

      let from: Date | undefined;
      let to: Date | undefined;
      if (query.date) {
        const range = vnDayRangeUtc(query.date);
        if (!range) {
          throw buildShowtimeValidationException([
            { field: 'date', message: MSG_INVALID_DATE },
          ]);
        }
        from = range.from;
        to = range.to;
      } else if (!query.includePast) {
        from = startOfTodayVnUtc(new Date());
      }

      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);
      const page = await this.showtimeQuery.searchShowtimesByRooms(
        rooms.map((room) => room.roomId),
        { movieId: query.movieId, roomId: query.roomId, from, to },
        query.page,
        query.limit,
      );

      const items = await this.toManagedList(page.items, rooms);
      return Page.from(items, page.total, page.page, page.limit);
    } catch (error) {
      this.fail(error, MSG_LOAD_FAILED);
    }
  }

  async getShowtime(
    user: AuthenticatedUser | undefined,
    showtimeId: string,
  ): Promise<ManagedShowtimeResDto> {
    try {
      const branchId = await this.resolveBranchId(user);
      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);
      const showtime = await this.findOwnedShowtime(showtimeId, rooms);
      const [item] = await this.toManagedList([showtime], rooms);
      return item;
    } catch (error) {
      this.fail(error, MSG_LOAD_FAILED);
    }
  }

  async createShowtime(
    user: AuthenticatedUser | undefined,
    input: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await this.resolveBranchId(user);
      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);

      const startTime = this.parseStartTime(input);
      const movie = await this.requireMovie(input.movieId);
      this.requireActiveRoom(input.roomId, rooms);
      this.assertFuture(startTime);

      const selections = await this.priceRuleQuery.resolvePriceSelections(
        input.priceSelections ?? [],
      );
      const created = await this.scheduleService.createShowtime(
        this.toScheduleInput(input, startTime, movie.duration, {
          basePrice: input.basePrice ?? DEFAULT_BASE_PRICE,
          ...selections,
        }),
      );

      return {
        message: MSG02,
        showtime: this.toManaged(created, movie, rooms, false),
      };
    } catch (error) {
      this.fail(error, MSG_SAVE_FAILED);
    }
  }

  async updateShowtime(
    user: AuthenticatedUser | undefined,
    showtimeId: string,
    input: SaveShowtimeReqDto,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await this.resolveBranchId(user);
      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);
      const existing = await this.findOwnedShowtime(showtimeId, rooms);

      if (this.hasStarted(existing)) {
        throw this.startedConflict(MSG_STARTED_EDIT);
      }
      if (await this.scheduleService.hasSoldTickets(showtimeId)) {
        throw this.soldConflict(SHOWTIME_SCHEDULE_MESSAGES.MSG04);
      }

      const startTime = this.parseStartTime(input);
      const movie = await this.requireMovie(input.movieId);
      this.requireActiveRoom(input.roomId, rooms);

      const scheduleChanged =
        startTime.getTime() !== new Date(existing.startTime).getTime() ||
        input.roomId !== existing.roomId;
      if (scheduleChanged) {
        this.assertFuture(startTime);
      }

      // Thiếu priceSelections -> giữ snapshot cũ; có mặt (kể cả []) -> resolve lại
      const selections =
        input.priceSelections === undefined
          ? {
              seatPriceSelections: existing.seatPriceSelections ?? [],
              dayPriceSelections: existing.dayPriceSelections ?? [],
            }
          : await this.priceRuleQuery.resolvePriceSelections(
              input.priceSelections,
            );

      const updated = await this.scheduleService.updateShowtime(
        showtimeId,
        this.toScheduleInput(input, startTime, movie.duration, {
          basePrice: input.basePrice ?? existing.basePrice,
          ...selections,
        }),
      );

      return {
        message: MSG02,
        showtime: this.toManaged(updated, movie, rooms, false),
      };
    } catch (error) {
      this.fail(error, MSG_SAVE_FAILED);
    }
  }

  async deleteShowtime(
    user: AuthenticatedUser | undefined,
    showtimeId: string,
  ): Promise<ShowtimeMutationResDto> {
    try {
      const branchId = await this.resolveBranchId(user);
      const rooms = await this.roomOptionQuery.listRoomsByBranch(branchId);
      const existing = await this.findOwnedShowtime(showtimeId, rooms);

      if (this.hasStarted(existing)) {
        throw this.startedConflict(MSG_STARTED_DELETE);
      }

      const deleted = await this.scheduleService.deleteShowtime(showtimeId);
      const movieInfo = await this.movieOptionQuery.getMovieSchedulingInfo(
        deleted.movieId,
      );
      return {
        message: MSG02,
        showtime: this.toManaged(
          deleted,
          movieInfo ?? this.unknownMovie(),
          rooms,
          false,
        ),
      };
    } catch (error) {
      this.fail(error, MSG_SAVE_FAILED);
    }
  }

  private async resolveBranchId(
    user: AuthenticatedUser | undefined,
  ): Promise<string> {
    if (!user?.userId) {
      throw new UnauthorizedException();
    }
    const branchId = await this.userBranchQuery.getBranchIdOfUser(user.userId);
    if (!branchId) {
      throw new ForbiddenException(MSG_NO_BRANCH);
    }
    return branchId;
  }

  // Suất không thuộc chi nhánh của Manager -> 404 (không tiết lộ sự tồn tại)
  private async findOwnedShowtime(
    showtimeId: string,
    rooms: RoomOptionResDto[],
  ): Promise<ShowtimeResDto> {
    let showtime: ShowtimeResDto;
    try {
      showtime = await this.showtimeQuery.getShowtimeDetail(showtimeId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(MSG_NOT_FOUND);
      }
      throw error;
    }
    if (!rooms.some((room) => room.roomId === showtime.roomId)) {
      throw new NotFoundException(MSG_NOT_FOUND);
    }
    return showtime;
  }

  private parseStartTime(input: SaveShowtimeReqDto): Date {
    if (!vnDayRangeUtc(input.screeningDate)) {
      throw buildShowtimeValidationException([
        { field: 'screeningDate', message: MSG_INVALID_DATE },
      ]);
    }
    const startTime = toUtcDate(input.screeningDate, input.startTime);
    if (!startTime) {
      throw buildShowtimeValidationException([
        { field: 'startTime', message: 'Start time is invalid. Use HH:mm.' },
      ]);
    }
    return startTime;
  }

  private async requireMovie(movieId: string): Promise<MovieInfo> {
    const movie = await this.movieOptionQuery.getMovieSchedulingInfo(movieId);
    if (!movie || !movie.isActive || movie.status === MovieStatus.ENDED) {
      throw buildShowtimeValidationException([
        { field: 'movieId', message: MSG_INVALID_MOVIE },
      ]);
    }
    return movie;
  }

  private requireActiveRoom(roomId: string, rooms: RoomOptionResDto[]): void {
    const room = rooms.find((item) => item.roomId === roomId);
    if (!room) {
      throw buildShowtimeValidationException([
        { field: 'roomId', message: MSG_INVALID_ROOM },
      ]);
    }
    if (room.roomStatus !== (RoomStatus.AVAILABLE as string)) {
      throw buildShowtimeValidationException([
        { field: 'roomId', message: MSG_ROOM_NOT_ACTIVE },
      ]);
    }
  }

  private assertFuture(startTime: Date): void {
    if (startTime.getTime() <= Date.now()) {
      throw buildShowtimeValidationException([
        { field: 'startTime', message: MSG_PAST_START },
      ]);
    }
  }

  private toScheduleInput(
    input: SaveShowtimeReqDto,
    startTime: Date,
    durationMinutes: number,
    extra: {
      basePrice: number;
      seatPriceSelections: ScheduleSeatSelectionDto[];
      dayPriceSelections: ScheduleDaySelectionDto[];
    },
  ): ScheduleShowtimeInputDto {
    return {
      movieId: input.movieId,
      roomId: input.roomId,
      startTime,
      endTime: addMinutes(startTime, durationMinutes),
      basePrice: extra.basePrice,
      seatPriceSelections: extra.seatPriceSelections,
      dayPriceSelections: extra.dayPriceSelections,
    };
  }

  private async toManagedList(
    showtimes: ShowtimeResDto[],
    rooms: RoomOptionResDto[],
  ): Promise<ManagedShowtimeResDto[]> {
    if (showtimes.length === 0) {
      return [];
    }
    const [movies, soldIds] = await Promise.all([
      this.movieOptionQuery.getMovieSchedulingInfos([
        ...new Set(showtimes.map((showtime) => showtime.movieId)),
      ]),
      this.scheduleService.findSoldShowtimeIds(
        showtimes.map((showtime) => showtime.showtimeId),
      ),
    ]);
    const movieMap = new Map(movies.map((movie) => [movie.movieId, movie]));
    return showtimes.map((showtime) =>
      this.toManaged(
        showtime,
        movieMap.get(showtime.movieId) ?? this.unknownMovie(),
        rooms,
        soldIds.has(showtime.showtimeId),
      ),
    );
  }

  private toManaged(
    showtime: ShowtimeResDto,
    movie: MovieInfo,
    rooms: RoomOptionResDto[],
    hasSoldTickets: boolean,
  ): ManagedShowtimeResDto {
    const room = rooms.find((item) => item.roomId === showtime.roomId);
    return {
      showtimeId: showtime.showtimeId,
      movieId: showtime.movieId,
      movieName: movie.movieName,
      movieDuration: movie.duration,
      posterUrl: movie.posterUrl,
      roomId: showtime.roomId,
      roomName: room?.roomName ?? '',
      startTime: showtime.startTime,
      endTime: showtime.endTime,
      basePrice: showtime.basePrice,
      seatPriceSelections: showtime.seatPriceSelections ?? [],
      dayPriceSelections: showtime.dayPriceSelections ?? [],
      hasSoldTickets,
    };
  }

  private unknownMovie(): MovieInfo {
    return { movieName: '', duration: 0 };
  }

  private hasStarted(showtime: ShowtimeResDto): boolean {
    return new Date(showtime.startTime).getTime() <= Date.now();
  }

  private startedConflict(message: string): ConflictException {
    return new ConflictException({
      statusCode: 409,
      message,
      error: 'Conflict',
      code: CODE_SHOWTIME_STARTED,
    });
  }

  private soldConflict(message: string): ConflictException {
    return new ConflictException({
      statusCode: 409,
      message,
      error: 'Conflict',
      code: SHOWTIME_ERROR_CODES.SHOWTIME_SOLD,
    });
  }

  private fail(error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    this.logger.error(
      fallbackMessage,
      error instanceof Error ? error.stack : String(error),
    );
    throw new InternalServerErrorException(fallbackMessage);
  }
}
