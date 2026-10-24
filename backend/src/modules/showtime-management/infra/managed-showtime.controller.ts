import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import { CurrentUser } from '../../auth/infra/decorators/current-user.decorator';
import { Role, Roles } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import {
  MovieOptionSearchReqDto,
  SaveShowtimeReqDto,
  SearchManagedShowtimeReqDto,
} from '../application/dto/req.dto';
import { ManagedShowtimeService } from '../application/services/managed-showtime.service';
import { ShowtimeFormOptionService } from '../application/services/showtime-form-option.service';
import { showtimeValidationExceptionFactory } from './pipes/showtime-validation.exception-factory';

@Controller('manager/showtimes')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.MANAGER)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: showtimeValidationExceptionFactory,
  }),
)
export class ManagedShowtimeController {
  constructor(
    private readonly managedShowtimeService: ManagedShowtimeService,
    private readonly formOptionService: ShowtimeFormOptionService,
  ) {}

  // `context` và `options/*` phải khai báo trước route `:id`
  @Get('context')
  getContext(@CurrentUser() user: AuthenticatedUser) {
    return this.formOptionService.getManagerContext(user.userId);
  }

  @Get('options/movies')
  searchMovieOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MovieOptionSearchReqDto,
  ) {
    return this.formOptionService.searchMovieOptions(user.userId, query);
  }

  @Get('options/rooms')
  listRoomOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.formOptionService.listRoomOptions(user.userId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchManagedShowtimeReqDto,
  ) {
    return this.managedShowtimeService.listShowtimes(user.userId, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.managedShowtimeService.getShowtime(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveShowtimeReqDto,
  ) {
    return this.managedShowtimeService.createShowtime(user.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SaveShowtimeReqDto,
  ) {
    return this.managedShowtimeService.updateShowtime(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.managedShowtimeService.deleteShowtime(user.userId, id);
  }
}
