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

  static of(params: {
    branchId: string;
    branchName: string;
    address: string;
    hotline: string;
    branchStatus: BranchStatus;
    totalRooms: number;
    activeRooms: number;
    maintenanceRooms: number;
    totalSeats: number;
    availableSeats: number;
    brokenSeats: number;
    standardSeats: number;
    vipSeats: number;
    coupleSeats: number;
    upcomingShowtimesCount: number;
    canDeactivate: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): AdminBranchItemDto {
    const res = new AdminBranchItemDto();
    Object.assign(res, params);
    return res;
  }
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
  }): AdminBranchRoomItemDto {
    const res = new AdminBranchRoomItemDto();
    Object.assign(res, params);
    return res;
  }
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

  static of(params: {
    totalBranches: number;
    activeBranches: number;
    maintenanceBranches: number;
    inactiveBranches: number;
    totalRooms: number;
    activeRooms: number;
    totalSeats: number;
    availableSeats: number;
  }): AdminBranchChainStatsDto {
    const res = new AdminBranchChainStatsDto();
    Object.assign(res, params);
    return res;
  }
}

export class AdminBranchListResponseDto {
  branches!: AdminBranchItemDto[];
  total!: number;
  chainStats!: AdminBranchChainStatsDto;

  static of(
    branches: AdminBranchItemDto[],
    total: number,
    chainStats: AdminBranchChainStatsDto,
  ): AdminBranchListResponseDto {
    const res = new AdminBranchListResponseDto();
    Object.assign(res, { branches, total, chainStats });
    return res;
  }
}

export class AdminBranchDetailResponseDto {
  branch!: AdminBranchItemDto;
  rooms!: AdminBranchRoomItemDto[];

  static of(
    branch: AdminBranchItemDto,
    rooms: AdminBranchRoomItemDto[],
  ): AdminBranchDetailResponseDto {
    const res = new AdminBranchDetailResponseDto();
    Object.assign(res, { branch, rooms });
    return res;
  }
}

export class AdminBranchMutationResponseDto {
  message!: string;
  branch!: AdminBranchItemDto;

  static of(
    message: string,
    branch: AdminBranchItemDto,
  ): AdminBranchMutationResponseDto {
    const res = new AdminBranchMutationResponseDto();
    Object.assign(res, { message, branch });
    return res;
  }
}

export class AdminBranchRoomCreatedResponseDto {
  message!: string;
  branch!: AdminBranchItemDto;
  room!: AdminBranchRoomItemDto;

  static of(
    message: string,
    branch: AdminBranchItemDto,
    room: AdminBranchRoomItemDto,
  ): AdminBranchRoomCreatedResponseDto {
    const res = new AdminBranchRoomCreatedResponseDto();
    Object.assign(res, { message, branch, room });
    return res;
  }
}

export class PublicBranchListResponseDto {
  branches!: AdminBranchItemDto[];
  total!: number;

  static of(
    branches: AdminBranchItemDto[],
    total: number,
  ): PublicBranchListResponseDto {
    const res = new PublicBranchListResponseDto();
    Object.assign(res, { branches, total });
    return res;
  }
}

export class BranchSummaryResDto {
  branchId!: string;
  branchName!: string;

  static of(branchId: string, branchName: string): BranchSummaryResDto {
    const res = new BranchSummaryResDto();
    Object.assign(res, { branchId, branchName });
    return res;
  }
}

export class PublicBranchResDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  hotline!: string;
  branchStatus!: BranchStatus;

  static of(
    branchId: string,
    branchName: string,
    address: string,
    hotline: string,
    branchStatus: BranchStatus,
  ): PublicBranchResDto {
    const res = new PublicBranchResDto();
    Object.assign(res, {
      branchId,
      branchName,
      address,
      hotline,
      branchStatus,
    });
    return res;
  }
}
