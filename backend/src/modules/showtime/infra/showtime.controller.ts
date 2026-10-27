import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  GetPublicShowtimesReqDto,
  SearchShowtimeReqDto,
} from '../application/dto/req.dto';
import { PublicShowtimeQueryService } from '../application/services/public-showtime-query.service';
import { SeatShowtimeQueryService } from '../application/services/seat-showtime-query.service';
import { ShowtimeQueryService } from '../application/services/showtime-query.service';

@Controller('showtimes')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ShowtimeController {
  constructor(
    private readonly showtimeQueryService: ShowtimeQueryService,
    private readonly seatShowtimeQueryService: SeatShowtimeQueryService,
    private readonly publicShowtimeQueryService: PublicShowtimeQueryService,
  ) {}

  @Get('public')
  getPublicShowtimes(@Query() query: GetPublicShowtimesReqDto) {
    return this.publicShowtimeQueryService.getPublicShowtimes(query);
  }

  @Get()
  searchShowtimes(@Query() query: SearchShowtimeReqDto) {
    return this.showtimeQueryService.searchShowtimes(query);
  }

  @Get(':id')
  getShowtimeDetail(@Param('id') id: string) {
    return this.showtimeQueryService.getShowtimeDetail(id);
  }

  @Get(':id/seats')
  getShowtimeSeats(@Param('id') id: string) {
    return this.seatShowtimeQueryService.getShowtimeSeats(id);
  }
}
