import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../../room/domain/schemas/room.schema';
import { RoomStatus } from '../../room/domain/enums/room-status.enum';
import { Seat, SeatDocument } from '../../room/domain/schemas/seat.schema';
import { SeatStatus } from '../../room/domain/enums/seat-status.enum';
import { SeatType } from '../../room/domain/enums/seat-type.enum';
import {
  Showtime,
  ShowtimeDocument,
} from '../../showtime/domain/schemas/showtime.schema';
import { Branch, BranchDocument } from '../domain/schemas/branch.schema';
import { BranchStatus } from '../domain/enums/branch-status.enum';
import { BRANCH_MESSAGES, canDeactivateBranch } from '../domain/branch.rules';
import {
  AdminBranchQueryDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/req.dto';
import {
  AdminBranchDetailResponseDto,
  AdminBranchItemDto,
  AdminBranchListResponseDto,
  AdminBranchMutationResponseDto,
  AdminBranchRoomItemDto,
} from './dto/res.dto';

@Injectable()
export class AdminBranchService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
  ) {}

  /**
   * UC08 Step 1 & 2: Danh sách chi nhánh cho Admin kèm thống kê toàn chuỗi và tìm kiếm / lọc
   */
  async listBranches(
    query: AdminBranchQueryDto,
  ): Promise<AdminBranchListResponseDto> {
    return this.guard(async () => {
      const allBranches = await this.branchModel
        .find()
        .sort({ createdAt: -1, branchName: 1 })
        .lean<
          (Branch & {
            createdAt?: Date;
            updatedAt?: Date;
          })[]
        >()
        .exec();

      const allEnriched = await this.enrichBranches(allBranches);

      const chainStats = {
        totalBranches: allEnriched.length,
        activeBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.ACTIVE,
        ).length,
        maintenanceBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.MAINTENANCE,
        ).length,
        inactiveBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.INACTIVE,
        ).length,
        totalRooms: allEnriched.reduce((acc, b) => acc + b.totalRooms, 0),
        activeRooms: allEnriched.reduce((acc, b) => acc + b.activeRooms, 0),
        totalSeats: allEnriched.reduce((acc, b) => acc + b.totalSeats, 0),
        availableSeats: allEnriched.reduce(
          (acc, b) => acc + b.availableSeats,
          0,
        ),
      };

      let filtered = allEnriched;
      if (query.branchStatus) {
        filtered = filtered.filter(
          (b) => b.branchStatus === query.branchStatus,
        );
      }
      if (query.search) {
        const kw = query.search.toLowerCase();
        filtered = filtered.filter(
          (b) =>
            b.branchName.toLowerCase().includes(kw) ||
            b.address.toLowerCase().includes(kw) ||
            (b.hotline ?? '').toLowerCase().includes(kw),
        );
      }

      return {
        branches: filtered,
        total: filtered.length,
        chainStats,
      };
    });
  }

  /**
   * Xem chi tiết 1 chi nhánh kèm danh sách các phòng chiếu & thống kê ghế của chi nhánh đó
   */
  async getBranchDetail(
    branchId: string,
  ): Promise<AdminBranchDetailResponseDto> {
    return this.guard(async () => {
      const branch = await this.branchModel
        .findOne({ branchId })
        .lean<Branch & { createdAt?: Date; updatedAt?: Date }>()
        .exec();

      if (!branch) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      const [enrichedBranches, rooms] = await Promise.all([
        this.enrichBranches([branch]),
        this.roomModel
          .find({ branchId })
          .sort({ roomName: 1 })
          .lean<Room[]>()
          .exec(),
      ]);

      const roomSummaries = await this.enrichRooms(rooms);

      return {
        branch: enrichedBranches[0],
        rooms: roomSummaries,
      };
    });
  }

  /**
   * UC08 Step 3-5: Tạo chi nhánh rạp mới (MSG04)
   */
  async createBranch(
    input: CreateBranchDto,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      const escapedName = input.branchName.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      const duplicate = await this.branchModel
        .exists({
          branchName: new RegExp(`^${escapedName}$`, 'i'),
        })
        .exec();

      if (duplicate) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: BRANCH_MESSAGES.BRANCH_NAME_EXISTS,
          fields: ['branchName'],
        });
      }

      const created = await this.branchModel.create({
        branchName: input.branchName.trim(),
        address: input.address.trim(),
        hotline: input.hotline?.trim() || '1900 2224',
        branchStatus: input.branchStatus ?? BranchStatus.ACTIVE,
      });

      const [enriched] = await this.enrichBranches([created.toObject()]);

      return {
        message: BRANCH_MESSAGES.MSG04_CREATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC08 Step 3-5: Cập nhật thông tin hoặc trạng thái chi nhánh (MSG03).
   * Kiểm tra BR-ADM-03 nếu chuyển trạng thái sang INACTIVE.
   */
  async updateBranch(
    branchId: string,
    input: UpdateBranchDto,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(BRANCH_MESSAGES.MSG02_REQUIRED);
      }

      const existing = await this.branchModel
        .findOne({ branchId })
        .lean<Branch>()
        .exec();

      if (!existing) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      if (
        input.branchName &&
        input.branchName.toLowerCase() !== existing.branchName.toLowerCase()
      ) {
        const escapedName = input.branchName.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        const duplicate = await this.branchModel
          .exists({
            branchId: { $ne: branchId },
            branchName: new RegExp(`^${escapedName}$`, 'i'),
          })
          .exec();

        if (duplicate) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: BRANCH_MESSAGES.BRANCH_NAME_EXISTS,
            fields: ['branchName'],
          });
        }
      }

      // BR-ADM-03 / AF-3: Nếu chuyển sang INACTIVE, phải kiểm tra phòng đang mở & suất chiếu sắp tới
      if (
        input.branchStatus === BranchStatus.INACTIVE &&
        existing.branchStatus !== BranchStatus.INACTIVE
      ) {
        await this.assertBranchCanBeDeactivated(branchId);
      }

      const setFields: Record<string, unknown> = {};
      if (input.branchName !== undefined) {
        setFields.branchName = input.branchName.trim();
      }
      if (input.address !== undefined) {
        setFields.address = input.address.trim();
      }
      if (input.hotline !== undefined) {
        setFields.hotline = input.hotline.trim() || '1900 2224';
      }
      if (input.branchStatus !== undefined) {
        setFields.branchStatus = input.branchStatus;
      }

      const updated = await this.branchModel
        .findOneAndUpdate(
          { branchId },
          { $set: setFields },
          { new: true, runValidators: true },
        )
        .lean<Branch & { createdAt?: Date; updatedAt?: Date }>()
        .exec();

      if (!updated) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      const [enriched] = await this.enrichBranches([updated]);

      return {
        message: BRANCH_MESSAGES.MSG03_UPDATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC08 Step 3-5 & AF-3 (BR-ADM-03): Vô hiệu hóa (Deactivate / Soft Delete) chi nhánh.
   * Chặn thao tác nếu chi nhánh đang có phòng chiếu AVAILABLE hoặc suất chiếu sắp diễn ra.
   */
  async deactivateBranch(
    branchId: string,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      const existing = await this.branchModel
        .findOne({ branchId })
        .lean<Branch>()
        .exec();

      if (!existing) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      await this.assertBranchCanBeDeactivated(branchId);

      const updated = await this.branchModel
        .findOneAndUpdate(
          { branchId },
          { $set: { branchStatus: BranchStatus.INACTIVE } },
          { new: true, runValidators: true },
        )
        .lean<Branch & { createdAt?: Date; updatedAt?: Date }>()
        .exec();

      if (!updated) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      const [enriched] = await this.enrichBranches([updated]);

      return {
        message: BRANCH_MESSAGES.MSG03_UPDATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC22 & UC23: Danh sách chi nhánh đang hoạt động cho khách (Guest / Public)
   */
  async listPublicBranches(search?: string) {
    return this.guard(async () => {
      const filter: Record<string, unknown> = {
        branchStatus: BranchStatus.ACTIVE,
      };
      if (search && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        filter.$or = [{ branchName: regex }, { address: regex }];
      }

      const branches = await this.branchModel
        .find(filter)
        .sort({ branchName: 1 })
        .lean<Branch[]>()
        .exec();

      const enriched = await this.enrichBranches(branches);
      return {
        branches: enriched,
        total: enriched.length,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async assertBranchCanBeDeactivated(branchId: string): Promise<void> {
    const rooms = await this.roomModel
      .find({ branchId })
      .select('roomId roomName roomStatus')
      .lean<{ roomId: string; roomName: string; roomStatus: RoomStatus }[]>()
      .exec();

    const activeRooms = rooms.filter(
      (r) => r.roomStatus === RoomStatus.AVAILABLE,
    );
    const roomIds = rooms.map((r) => r.roomId);

    const upcomingShowtimesCount =
      roomIds.length > 0
        ? await this.showtimeModel
            .countDocuments({
              roomId: { $in: roomIds },
              endTime: { $gt: new Date() },
            })
            .exec()
        : 0;

    if (!canDeactivateBranch(activeRooms.length, upcomingShowtimesCount)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: BRANCH_MESSAGES.MSG06_CANNOT_DEACTIVATE,
        details: {
          activeRoomsCount: activeRooms.length,
          activeRoomNames: activeRooms.map((r) => r.roomName),
          upcomingShowtimesCount,
        },
      });
    }
  }

  private async enrichBranches(
    branches: (Branch & { createdAt?: Date; updatedAt?: Date })[],
  ): Promise<AdminBranchItemDto[]> {
    if (branches.length === 0) return [];

    const branchIds = branches.map((b) => b.branchId);
    const rooms = await this.roomModel
      .find({ branchId: { $in: branchIds } })
      .select('roomId roomName roomStatus branchId')
      .lean<Room[]>()
      .exec();

    const roomIds = rooms.map((r) => r.roomId);
    const now = new Date();

    const [seatStats, showtimeStats] = await Promise.all([
      roomIds.length > 0
        ? this.seatModel.aggregate<{
            _id: string;
            totalSeats: number;
            availableSeats: number;
            brokenSeats: number;
            standardSeats: number;
            vipSeats: number;
            coupleSeats: number;
          }>([
            { $match: { roomId: { $in: roomIds } } },
            {
              $group: {
                _id: '$roomId',
                totalSeats: { $sum: 1 },
                availableSeats: {
                  $sum: {
                    $cond: [{ $eq: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
                  },
                },
                brokenSeats: {
                  $sum: {
                    $cond: [{ $ne: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
                  },
                },
                standardSeats: {
                  $sum: {
                    $cond: [{ $eq: ['$seatType', SeatType.STANDARD] }, 1, 0],
                  },
                },
                vipSeats: {
                  $sum: {
                    $cond: [{ $eq: ['$seatType', SeatType.VIP] }, 1, 0],
                  },
                },
                coupleSeats: {
                  $sum: {
                    $cond: [{ $eq: ['$seatType', SeatType.COUPLE] }, 1, 0],
                  },
                },
              },
            },
          ])
        : Promise.resolve([]),
      roomIds.length > 0
        ? this.showtimeModel.aggregate<{
            _id: string;
            upcomingCount: number;
          }>([
            {
              $match: {
                roomId: { $in: roomIds },
                endTime: { $gt: now },
              },
            },
            {
              $group: {
                _id: '$roomId',
                upcomingCount: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const seatStatByRoom = new Map(seatStats.map((s) => [s._id, s]));
    const showtimeCountByRoom = new Map(
      showtimeStats.map((s) => [s._id, s.upcomingCount]),
    );

    const roomsByBranch = new Map<string, Room[]>();
    for (const room of rooms) {
      const list = roomsByBranch.get(room.branchId) ?? [];
      list.push(room);
      roomsByBranch.set(room.branchId, list);
    }

    return branches.map((branch) => {
      const branchRooms = roomsByBranch.get(branch.branchId) ?? [];
      const totalRooms = branchRooms.length;
      const activeRooms = branchRooms.filter(
        (r) => r.roomStatus === RoomStatus.AVAILABLE,
      ).length;
      const maintenanceRooms = branchRooms.filter(
        (r) => r.roomStatus !== RoomStatus.AVAILABLE,
      ).length;

      let totalSeats = 0;
      let availableSeats = 0;
      let brokenSeats = 0;
      let standardSeats = 0;
      let vipSeats = 0;
      let coupleSeats = 0;
      let upcomingShowtimesCount = 0;

      for (const room of branchRooms) {
        const seatStat = seatStatByRoom.get(room.roomId);
        totalSeats += seatStat?.totalSeats ?? 0;
        availableSeats += seatStat?.availableSeats ?? 0;
        brokenSeats += seatStat?.brokenSeats ?? 0;
        standardSeats += seatStat?.standardSeats ?? 0;
        vipSeats += seatStat?.vipSeats ?? 0;
        coupleSeats += seatStat?.coupleSeats ?? 0;
        upcomingShowtimesCount += showtimeCountByRoom.get(room.roomId) ?? 0;
      }

      return {
        branchId: branch.branchId,
        branchName: branch.branchName,
        address: branch.address,
        hotline: branch.hotline || '1900 2224',
        branchStatus: branch.branchStatus,
        totalRooms,
        activeRooms,
        maintenanceRooms,
        totalSeats,
        availableSeats,
        brokenSeats,
        standardSeats,
        vipSeats,
        coupleSeats,
        upcomingShowtimesCount,
        canDeactivate: canDeactivateBranch(activeRooms, upcomingShowtimesCount),
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      };
    });
  }

  private async enrichRooms(rooms: Room[]): Promise<AdminBranchRoomItemDto[]> {
    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.roomId);
    const now = new Date();

    const [seatStats, showtimeStats] = await Promise.all([
      this.seatModel.aggregate<{
        _id: string;
        totalSeats: number;
        availableSeats: number;
        brokenSeats: number;
        standardSeats: number;
        vipSeats: number;
        coupleSeats: number;
      }>([
        { $match: { roomId: { $in: roomIds } } },
        {
          $group: {
            _id: '$roomId',
            totalSeats: { $sum: 1 },
            availableSeats: {
              $sum: {
                $cond: [{ $eq: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
            brokenSeats: {
              $sum: {
                $cond: [{ $ne: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
            standardSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.STANDARD] }, 1, 0],
              },
            },
            vipSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.VIP] }, 1, 0],
              },
            },
            coupleSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.COUPLE] }, 1, 0],
              },
            },
          },
        },
      ]),
      this.showtimeModel.aggregate<{
        _id: string;
        upcomingCount: number;
      }>([
        {
          $match: {
            roomId: { $in: roomIds },
            endTime: { $gt: now },
          },
        },
        {
          $group: {
            _id: '$roomId',
            upcomingCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const seatMap = new Map(seatStats.map((s) => [s._id, s]));
    const showtimeMap = new Map(
      showtimeStats.map((s) => [s._id, s.upcomingCount]),
    );

    return rooms.map((room) => {
      const stat = seatMap.get(room.roomId);
      return {
        roomId: room.roomId,
        roomName: room.roomName,
        roomStatus: room.roomStatus,
        branchId: room.branchId,
        totalSeats: stat?.totalSeats ?? 0,
        availableSeats: stat?.availableSeats ?? 0,
        brokenSeats: stat?.brokenSeats ?? 0,
        standardSeats: stat?.standardSeats ?? 0,
        vipSeats: stat?.vipSeats ?? 0,
        coupleSeats: stat?.coupleSeats ?? 0,
        upcomingShowtimesCount: showtimeMap.get(room.roomId) ?? 0,
      };
    });
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const name =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: unknown }).name)
          : '';
      if (
        /Mongo(ose)?(Network|ServerSelection|NotConnected|Timeout)/i.test(name)
      ) {
        throw new ServiceUnavailableException(
          BRANCH_MESSAGES.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}
