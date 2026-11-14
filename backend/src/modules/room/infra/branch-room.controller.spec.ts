import { BadRequestException } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { BranchRoomController } from './branch-room.controller';
import { BranchRoomService } from '../application/branch-room.service';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { RoomStatus, SeatType, SeatStatus } from '@prisma/client';
import {
  CreateBranchRoomDto,
  ReplaceRoomLayoutDto,
  UpdateBranchRoomDto,
  UpdateRoomSeatsDto,
} from '../application/dto/req.dto';
import { ROOM_MESSAGES } from '../domain/room.rules';

describe('BranchRoomController (Pattern B)', () => {
  let controller: BranchRoomController;
  let branchRoomService: Partial<Record<keyof BranchRoomService, jest.Mock>>;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  const mockManagerReq = {
    headers: {
      authorization: 'Bearer manager.token.here',
    },
  } as unknown as Request;

  beforeEach(async () => {
    branchRoomService = {
      listRooms: jest.fn(),
      getRoomDetail: jest.fn(),
      createRoom: jest.fn(),
      updateRoom: jest.fn(),
      updateSeats: jest.fn(),
      replaceRoomLayout: jest.fn(),
    };

    jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'mgr-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchRoomController],
      providers: [
        {
          provide: BranchRoomService,
          useValue: branchRoomService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    controller = module.get<BranchRoomController>(BranchRoomController);
  });

  it('khởi tạo BranchRoomController thành công từ TestingModule', () => {
    expect(controller).toBeDefined();
  });

  describe('listRooms (GET /manager/rooms)', () => {
    it('gọi branchRoomService.listRooms với managerUserId và query', async () => {
      const query = { search: 'Phòng 1', roomStatus: RoomStatus.AVAILABLE };
      const mockResult = {
        branch: { id: 'b-1', branchName: 'Latte Landmark' },
        rooms: [{ id: 'r-1', roomName: 'Phòng 1' }],
      };

      (branchRoomService.listRooms as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.listRooms(mockManagerReq, query);

      expect(jwtService.verify).toHaveBeenCalledWith('manager.token.here');
      expect(branchRoomService.listRooms).toHaveBeenCalledWith('mgr-001', query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getRoomDetail (GET /manager/rooms/:roomId)', () => {
    it('gọi branchRoomService.getRoomDetail với managerUserId và roomId', async () => {
      const mockDetail = { id: 'r-1', roomName: 'Phòng 1', seats: [] };
      (branchRoomService.getRoomDetail as jest.Mock).mockResolvedValue(mockDetail);

      const result = await controller.getRoomDetail(mockManagerReq, 'r-1');

      expect(branchRoomService.getRoomDetail).toHaveBeenCalledWith('mgr-001', 'r-1');
      expect(result).toEqual(mockDetail);
    });
  });

  describe('createRoom (POST /manager/rooms)', () => {
    it('gọi branchRoomService.createRoom khi tạo phòng chiếu mới', async () => {
      const input: CreateBranchRoomDto = {
        roomName: 'Phòng chiếu IMAX 01',
        rowCount: 8,
        columnsPerRow: 10,
        roomStatus: RoomStatus.AVAILABLE,
      };

      const mockCreated = {
        message: 'Tạo phòng thành công',
        room: { id: 'r-new', roomName: input.roomName },
      };

      (branchRoomService.createRoom as jest.Mock).mockResolvedValue(mockCreated);

      const result = await controller.createRoom(mockManagerReq, input);

      expect(branchRoomService.createRoom).toHaveBeenCalledWith('mgr-001', input);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateRoom (PATCH /manager/rooms/:roomId)', () => {
    it('gọi branchRoomService.updateRoom để đổi tên hoặc trạng thái phòng', async () => {
      const input: UpdateBranchRoomDto = {
        roomName: 'Phòng VIP 01 Updated',
        roomStatus: RoomStatus.MAINTENANCE,
      };

      const mockUpdated = {
        message: 'Cập nhật phòng thành công',
        room: { id: 'r-1', ...input },
      };

      (branchRoomService.updateRoom as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await controller.updateRoom(mockManagerReq, 'r-1', input);

      expect(branchRoomService.updateRoom).toHaveBeenCalledWith('mgr-001', 'r-1', input);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('updateSeats (PATCH /manager/rooms/:roomId/seats)', () => {
    it('gọi branchRoomService.updateSeats để cập nhật loại ghế hoặc trạng thái ghế', async () => {
      const input: UpdateRoomSeatsDto = {
        seatIds: ['seat-1', 'seat-2'],
        seatType: SeatType.VIP,
        status: SeatStatus.BROKEN,
      };

      const mockSeatUpdate = {
        message: 'Cập nhật ghế thành công',
        updatedCount: 2,
      };

      (branchRoomService.updateSeats as jest.Mock).mockResolvedValue(mockSeatUpdate);

      const result = await controller.updateSeats(mockManagerReq, 'r-1', input);

      expect(branchRoomService.updateSeats).toHaveBeenCalledWith('mgr-001', 'r-1', input);
      expect(result).toEqual(mockSeatUpdate);
    });
  });

  describe('replaceRoomLayout (PUT & PATCH /manager/rooms/:roomId/layout)', () => {
    const layoutInput: ReplaceRoomLayoutDto = {
      seats: [
        { seatName: 'A01', seatType: SeatType.STANDARD, row: 'A', column: 1, coordinates: { x: 0, y: 0 } },
        { seatName: 'A02', seatType: SeatType.STANDARD, row: 'A', column: 2, coordinates: { x: 1, y: 0 } },
      ],
    };

    it('gọi branchRoomService.replaceRoomLayout qua method PUT', async () => {
      const mockResult = { message: 'Cập nhật sơ đồ ghế thành công' };
      (branchRoomService.replaceRoomLayout as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.replaceRoomLayout(mockManagerReq, 'r-1', layoutInput);

      expect(branchRoomService.replaceRoomLayout).toHaveBeenCalledWith('mgr-001', 'r-1', layoutInput);
      expect(result).toEqual(mockResult);
    });

    it('gọi branchRoomService.replaceRoomLayout qua method PATCH', async () => {
      const mockResult = { message: 'Cập nhật sơ đồ ghế thành công' };
      (branchRoomService.replaceRoomLayout as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.patchRoomLayout(mockManagerReq, 'r-1', layoutInput);

      expect(branchRoomService.replaceRoomLayout).toHaveBeenCalledWith('mgr-001', 'r-1', layoutInput);
      expect(result).toEqual(mockResult);
    });
  });

  describe('extractUserId fallback & roomValidationPipe', () => {
    it('truyền undefined cho service khi header authorization thiếu hoặc token verify lỗi', async () => {
      (branchRoomService.listRooms as jest.Mock).mockResolvedValue({ rooms: [] });

      await controller.listRooms({ headers: {} } as unknown as Request, {});
      expect(branchRoomService.listRooms).toHaveBeenCalledWith(undefined, {});

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });
      await controller.listRooms(mockManagerReq, {});
      expect(branchRoomService.listRooms).toHaveBeenLastCalledWith(
        undefined,
        {},
      );
    });

    it('roomValidationPipe format lỗi flat và nested ValidationError đúng chuẩn ROOM_MESSAGES', async () => {
      const pipes = Reflect.getMetadata(
        PIPES_METADATA,
        BranchRoomController,
      ) as Array<{ transform: (value: unknown, meta: any) => Promise<unknown> }>;
      expect(pipes).toHaveLength(1);
      const pipe = pipes[0];

      const validDto = await pipe.transform(
        { roomName: '  Phòng A  ', rowCount: '5', columnsPerRow: '8' },
        { type: 'body', metatype: CreateBranchRoomDto },
      );
      expect(validDto).toMatchObject({
        roomName: 'Phòng A',
        rowCount: 5,
        columnsPerRow: 8,
      });

      const err = await pipe
        .transform(
          {
            roomName: '',
            customSeats: [{ rowPosition: '', columnPosition: 0, seatType: 'BAD' }],
          },
          { type: 'body', metatype: CreateBranchRoomDto },
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: ROOM_MESSAGES.MSG01_INVALID_INPUT,
        fields: expect.arrayContaining(['roomName', 'customSeats']),
        errors: expect.any(Array),
      });
    });
  });
});
