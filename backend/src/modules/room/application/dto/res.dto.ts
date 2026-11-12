import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { RoomStatus } from '../../domain/enums/room-status.enum';
import { SeatStatus } from '../../domain/enums/seat-status.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class RoomManagerBranchDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: BranchStatus;

  static of(
    branchId: string,
    branchName: string,
    address: string,
    branchStatus: BranchStatus,
  ): RoomManagerBranchDto {
    const res = new RoomManagerBranchDto();
    Object.assign(res, {
      branchId,
      branchName,
      address,
      branchStatus,
    });
    return res;
  }
}

export class BranchRoomSummaryDto {
  roomId!: string;
  roomName!: string;
  roomStatus!: RoomStatus;
  branchId!: string;
  totalSeats!: number;
  availableSeats!: number;
  brokenSeats!: number;
  standardSeats!: number;
  vipSeats!: number;
  coupleSeats!: number;
  upcomingShowtimesCount!: number;

  static of(params: {
    roomId: string;
    roomName: string;
    roomStatus: RoomStatus;
    branchId: string;
    totalSeats: number;
    availableSeats: number;
    brokenSeats: number;
    standardSeats: number;
    vipSeats: number;
    coupleSeats: number;
    upcomingShowtimesCount: number;
  }): BranchRoomSummaryDto {
    const res = new BranchRoomSummaryDto();
    Object.assign(res, params);
    return res;
  }
}

export class RoomSeatItemDto {
  seatId!: string;
  roomId!: string;
  rowPosition!: string;
  columnPosition!: number;
  seatLabel!: string;
  seatType!: SeatType;
  status!: SeatStatus;
  isBroken!: boolean;
  hasUpcomingBookedTicket!: boolean;

  static of(params: {
    seatId: string;
    roomId: string;
    rowPosition: string;
    columnPosition: number;
    seatLabel: string;
    seatType: SeatType;
    status: SeatStatus;
    isBroken: boolean;
    hasUpcomingBookedTicket: boolean;
  }): RoomSeatItemDto {
    const res = new RoomSeatItemDto();
    Object.assign(res, params);
    return res;
  }
}

export class RoomUpcomingShowtimeDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  startTime!: Date;
  endTime!: Date;

  static of(
    showtimeId: string,
    movieId: string,
    movieName: string,
    startTime: Date,
    endTime: Date,
  ): RoomUpcomingShowtimeDto {
    const res = new RoomUpcomingShowtimeDto();
    Object.assign(res, {
      showtimeId,
      movieId,
      movieName,
      startTime,
      endTime,
    });
    return res;
  }
}

export class BranchRoomListResponseDto {
  branch!: RoomManagerBranchDto;
  rooms!: BranchRoomSummaryDto[];
  total!: number;

  static of(
    branch: RoomManagerBranchDto,
    rooms: BranchRoomSummaryDto[],
    total: number,
  ): BranchRoomListResponseDto {
    const res = new BranchRoomListResponseDto();
    Object.assign(res, { branch, rooms, total });
    return res;
  }
}

export class BranchRoomDetailResponseDto {
  branch!: RoomManagerBranchDto;
  room!: BranchRoomSummaryDto;
  seats!: RoomSeatItemDto[];
  upcomingShowtimes!: RoomUpcomingShowtimeDto[];

  static of(
    branch: RoomManagerBranchDto,
    room: BranchRoomSummaryDto,
    seats: RoomSeatItemDto[],
    upcomingShowtimes: RoomUpcomingShowtimeDto[],
  ): BranchRoomDetailResponseDto {
    const res = new BranchRoomDetailResponseDto();
    Object.assign(res, {
      branch,
      room,
      seats,
      upcomingShowtimes,
    });
    return res;
  }
}

export class BranchRoomMutationResponseDto {
  message!: string;
  room!: BranchRoomSummaryDto;

  static of(
    message: string,
    room: BranchRoomSummaryDto,
  ): BranchRoomMutationResponseDto {
    const res = new BranchRoomMutationResponseDto();
    Object.assign(res, { message, room });
    return res;
  }
}

export class BranchRoomSeatsMutationResponseDto {
  message!: string;
  updatedCount!: number;
  room!: BranchRoomSummaryDto;
  seats!: RoomSeatItemDto[];

  static of(
    message: string,
    updatedCount: number,
    room: BranchRoomSummaryDto,
    seats: RoomSeatItemDto[],
  ): BranchRoomSeatsMutationResponseDto {
    const res = new BranchRoomSeatsMutationResponseDto();
    Object.assign(res, {
      message,
      updatedCount,
      room,
      seats,
    });
    return res;
  }
}

export class RoomOptionResDto {
  roomId!: string;
  roomName!: string;
  roomStatus!: string;
  branchId!: string;

  static of(
    roomId: string,
    roomName: string,
    roomStatus: string,
    branchId: string,
  ): RoomOptionResDto {
    const res = new RoomOptionResDto();
    Object.assign(res, {
      roomId,
      roomName,
      roomStatus,
      branchId,
    });
    return res;
  }
}
