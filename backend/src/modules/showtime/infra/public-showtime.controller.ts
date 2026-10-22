/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { PublicShowtimeService } from '../application/public-showtime.service';
import { PublicShowtimeQueryDto } from '../application/dto/req.dto';
import { SHOWTIME_MESSAGES } from '../domain/showtime.rules';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? [], path),
    ];
  });

const publicShowtimeValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: SHOWTIME_MESSAGES.MSG01,
      errors: flatten(errors),
      fields: errors.map((error) => error.property),
    }),
});

@Controller('showtimes')
@UsePipes(publicShowtimeValidationPipe)
export class PublicShowtimeController {
  constructor(
    private readonly publicShowtimeService: PublicShowtimeService,
  ) {}

  @Get()
  listShowtimes(@Query() query: PublicShowtimeQueryDto) {
    return this.publicShowtimeService.listShowtimes(query);
  }

  @Get(':showtimeId')
  getShowtimeDetail(@Param('showtimeId') showtimeId: string) {
    return this.publicShowtimeService.getShowtimeSeats(showtimeId);
  }

  @Get(':showtimeId/seats')
  getShowtimeSeats(@Param('showtimeId') showtimeId: string) {
    return this.publicShowtimeService.getShowtimeSeats(showtimeId);
  }
}
