import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { RoomStatus } from '../../domain/enums/room-status.enum';
import { SeatStatus } from '../../domain/enums/seat-status.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class RoomManagerBranchDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: BranchStatus;

  static from(params: {
    branchId: string;
    branchName: string;
    address: string;
    branchStatus: BranchStatus;
  }): RoomManagerBranchDto {
    const dto = new RoomManagerBranchDto();
    dto.branchId = params.branchId;
    dto.branchName = params.branchName;
    dto.address = params.address;
    dto.branchStatus = params.branchStatus;
    return dto;
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

  static from(params: {
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
    const dto = new BranchRoomSummaryDto();
    dto.roomId = params.roomId;
    dto.roomName = params.roomName;
    dto.roomStatus = params.roomStatus;
    dto.branchId = params.branchId;
    dto.totalSeats = params.totalSeats;
    dto.availableSeats = params.availableSeats;
    dto.brokenSeats = params.brokenSeats;
    dto.standardSeats = params.standardSeats;
    dto.vipSeats = params.vipSeats;
    dto.coupleSeats = params.coupleSeats;
    dto.upcomingShowtimesCount = params.upcomingShowtimesCount;
    return dto;
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

  static from(params: {
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
    const dto = new RoomSeatItemDto();
    dto.seatId = params.seatId;
    dto.roomId = params.roomId;
    dto.rowPosition = params.rowPosition;
    dto.columnPosition = params.columnPosition;
    dto.seatLabel = params.seatLabel;
    dto.seatType = params.seatType;
    dto.status = params.status;
    dto.isBroken = params.isBroken;
    dto.hasUpcomingBookedTicket = params.hasUpcomingBookedTicket;
    return dto;
  }
}

export class RoomUpcomingShowtimeDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  startTime!: Date;
  endTime!: Date;
}

export class BranchRoomListResponseDto {
  branch!: RoomManagerBranchDto;
  rooms!: BranchRoomSummaryDto[];
  total!: number;
}

export class BranchRoomDetailResponseDto {
  branch!: RoomManagerBranchDto;
  room!: BranchRoomSummaryDto;
  seats!: RoomSeatItemDto[];
  upcomingShowtimes!: RoomUpcomingShowtimeDto[];
}

export class BranchRoomMutationResponseDto {
  message!: string;
  room!: BranchRoomSummaryDto;
}

export class BranchRoomSeatsMutationResponseDto {
  message!: string;
  updatedCount!: number;
  room!: BranchRoomSummaryDto;
  seats!: RoomSeatItemDto[];
}

export class RoomOptionResDto {
  roomId!: string;
  roomName!: string;
  roomStatus!: string;
  branchId!: string;

  static from(params: {
    roomId: string;
    roomName: string;
    roomStatus: string;
    branchId: string;
  }): RoomOptionResDto {
    const dto = new RoomOptionResDto();
    dto.roomId = params.roomId;
    dto.roomName = params.roomName;
    dto.roomStatus = params.roomStatus;
    dto.branchId = params.branchId;
    return dto;
  }
}
