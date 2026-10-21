/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../../auth/domain/auth-user';
import { BranchShowtimeService } from '../application/branch-showtime.service';
import {
  BranchShowtimeQueryDto,
  CreateBranchShowtimeDto,
  UpdateBranchShowtimeDto,
} from '../application/dto/branch-showtime.dto';
import { SHOWTIME_MESSAGES } from '../domain/showtime.rules';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? [], path),
    ];
  });

/**
 * AF-1: Mọi lỗi thiếu trường bắt buộc / sai định dạng đều trả về MSG01 kèm danh sách fields lỗi.
 */
const showtimeValidationPipe = new ValidationPipe({
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

@Controller('manager/showtimes')
@UsePipes(showtimeValidationPipe)
export class BranchShowtimeController {
  constructor(
    private readonly branchShowtimeService: BranchShowtimeService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserId(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) return undefined;
    try {
      const payload = this.jwtService.verify<AuthUser>(token);
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  @Get('options')
  getOptions(@Req() req: Request) {
    return this.branchShowtimeService.getOptions(this.extractUserId(req));
  }

  @Get()
  listShowtimes(
    @Req() req: Request,
    @Query() query: BranchShowtimeQueryDto,
  ) {
    return this.branchShowtimeService.listShowtimes(
      this.extractUserId(req),
      query,
    );
  }

  @Get(':showtimeId')
  getShowtime(
    @Req() req: Request,
    @Param('showtimeId') showtimeId: string,
  ) {
    return this.branchShowtimeService.getShowtime(
      this.extractUserId(req),
      showtimeId,
    );
  }

  @Post()
  createShowtime(
    @Req() req: Request,
    @Body() input: CreateBranchShowtimeDto,
  ) {
    return this.branchShowtimeService.createShowtime(
      this.extractUserId(req),
      input,
    );
  }

  @Patch(':showtimeId')
  updateShowtime(
    @Req() req: Request,
    @Param('showtimeId') showtimeId: string,
    @Body() input: UpdateBranchShowtimeDto,
  ) {
    return this.branchShowtimeService.updateShowtime(
      this.extractUserId(req),
      showtimeId,
      input,
    );
  }

  @Delete(':showtimeId')
  deleteShowtime(
    @Req() req: Request,
    @Param('showtimeId') showtimeId: string,
  ) {
    return this.branchShowtimeService.deleteShowtime(
      this.extractUserId(req),
      showtimeId,
    );
  }
}
