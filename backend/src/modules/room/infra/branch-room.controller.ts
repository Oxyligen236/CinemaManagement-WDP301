/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Body,
  Controller,
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
import { BranchRoomService } from '../application/branch-room.service';
import {
  BranchRoomQueryDto,
  CreateBranchRoomDto,
  UpdateBranchRoomDto,
  UpdateRoomSeatsDto,
} from '../application/dto/req.dto';
import { ROOM_MESSAGES } from '../domain/room.rules';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? [], path),
    ];
  });

const roomValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: ROOM_MESSAGES.MSG01_INVALID_INPUT,
      errors: flatten(errors),
      fields: errors.map((error) => error.property),
    }),
});

@Controller('manager/rooms')
@UsePipes(roomValidationPipe)
export class BranchRoomController {
  constructor(
    private readonly branchRoomService: BranchRoomService,
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

  @Get()
  listRooms(@Req() req: Request, @Query() query: BranchRoomQueryDto) {
    return this.branchRoomService.listRooms(this.extractUserId(req), query);
  }

  @Get(':roomId')
  getRoomDetail(@Req() req: Request, @Param('roomId') roomId: string) {
    return this.branchRoomService.getRoomDetail(
      this.extractUserId(req),
      roomId,
    );
  }

  @Post()
  createRoom(@Req() req: Request, @Body() input: CreateBranchRoomDto) {
    return this.branchRoomService.createRoom(this.extractUserId(req), input);
  }

  @Patch(':roomId')
  updateRoom(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Body() input: UpdateBranchRoomDto,
  ) {
    return this.branchRoomService.updateRoom(
      this.extractUserId(req),
      roomId,
      input,
    );
  }

  @Patch(':roomId/seats')
  updateSeats(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Body() input: UpdateRoomSeatsDto,
  ) {
    return this.branchRoomService.updateSeats(
      this.extractUserId(req),
      roomId,
      input,
    );
  }
}
