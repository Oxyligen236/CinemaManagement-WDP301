import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { RoomStatus } from '../../domain/enums/room-status.enum';
import { SeatStatus } from '../../domain/enums/seat-status.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class RoomManagerBranchDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: BranchStatus;
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
}
