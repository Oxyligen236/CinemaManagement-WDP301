import { BranchStatus } from '../../domain/enums/branch-status.enum';
import { RoomStatus } from '../../../room/domain/enums/room-status.enum';

export class AdminBranchItemDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  hotline!: string;
  branchStatus!: BranchStatus;
  totalRooms!: number;
  activeRooms!: number;
  maintenanceRooms!: number;
  totalSeats!: number;
  availableSeats!: number;
  brokenSeats!: number;
  standardSeats!: number;
  vipSeats!: number;
  coupleSeats!: number;
  upcomingShowtimesCount!: number;
  canDeactivate!: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AdminBranchRoomItemDto {
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

export class AdminBranchChainStatsDto {
  totalBranches!: number;
  activeBranches!: number;
  maintenanceBranches!: number;
  inactiveBranches!: number;
  totalRooms!: number;
  activeRooms!: number;
  totalSeats!: number;
  availableSeats!: number;
}

export class AdminBranchListResponseDto {
  branches!: AdminBranchItemDto[];
  total!: number;
  chainStats!: AdminBranchChainStatsDto;
}

export class AdminBranchDetailResponseDto {
  branch!: AdminBranchItemDto;
  rooms!: AdminBranchRoomItemDto[];
}

export class AdminBranchMutationResponseDto {
  message!: string;
  branch!: AdminBranchItemDto;
}

export class AdminBranchRoomCreatedResponseDto {
  message!: string;
  branch!: AdminBranchItemDto;
  room!: AdminBranchRoomItemDto;
}
