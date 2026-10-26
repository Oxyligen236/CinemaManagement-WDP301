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
import { CurrentUser } from '../../auth/infra/decorators/current-user.decorator';
import { Role, Roles } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import {
  MovieOptionSearchReqDto,
  SaveShowtimeReqDto,
  SearchManagedShowtimeReqDto,
} from '../application/dto/req.dto';
import { ShowtimeManagementService } from '../application/services/showtime-management.service';
import { showtimeValidationExceptionFactory } from './save-showtime-validation.exception-factory';

@Controller('manager/showtimes')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: showtimeValidationExceptionFactory,
  }),
)
export class ShowtimeManagementController {
  constructor(private readonly service: ShowtimeManagementService) {}

  // context và options/* phải khai báo trước route :id
  @Get('context')
  getContext(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.service.getContext(user);
  }

  @Get('options/movies')
  searchMovieOptions(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: MovieOptionSearchReqDto,
  ) {
    return this.service.searchMovieOptions(user, query);
  }

  @Get('options/rooms')
  listRoomOptions(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.service.listRoomOptions(user);
  }

  @Get()
  listShowtimes(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: SearchManagedShowtimeReqDto,
  ) {
    return this.service.listShowtimes(user, query);
  }

  @Get(':id')
  getShowtime(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ) {
    return this.service.getShowtime(user, id);
  }

  @Post()
  createShowtime(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: SaveShowtimeReqDto,
  ) {
    return this.service.createShowtime(user, body);
  }

  @Patch(':id')
  updateShowtime(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() body: SaveShowtimeReqDto,
  ) {
    return this.service.updateShowtime(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  deleteShowtime(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ) {
    return this.service.deleteShowtime(user, id);
  }
}
