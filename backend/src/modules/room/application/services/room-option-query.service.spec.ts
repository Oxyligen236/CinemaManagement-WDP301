import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Room } from '../../domain/schemas/room.schema';
import { RoomOptionQueryService } from './room-option-query.service';

const chain = (result: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const MOCK_ROOMS = [
  {
    _id: 'r-1',
    roomName: 'Phòng 1',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    _id: 'r-2',
    roomName: 'Phòng 2',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    _id: 'r-3',
    roomName: 'Phòng 3',
    roomStatus: 'MAINTENANCE',
    branchId: BRANCH_A,
  },
  {
    _id: 'r-9',
    roomName: 'Phòng X',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_B,
  },
];

describe('RoomOptionQueryService', () => {
  let service: RoomOptionQueryService;
  const roomModel = { find: jest.fn(), findById: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    roomModel.find.mockImplementation(
      (f?: { branchId?: string; _id?: { $in: string[] } }) =>
        chain(
          MOCK_ROOMS.filter(
            (r) =>
              (!f?.branchId || r.branchId === f.branchId) &&
              (!f?._id || f._id.$in.includes(r._id)),
          ),
        ),
    );
    roomModel.findById.mockImplementation((id: string) =>
      chain(MOCK_ROOMS.find((r) => r._id === id) ?? null),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomOptionQueryService,
        { provide: getModelToken(Room.name), useValue: roomModel },
      ],
    }).compile();
    service = moduleRef.get(RoomOptionQueryService);
  });

  describe('listRoomsByBranch', () => {
    it('filters by branch, sorts by roomName and keeps non-available rooms', async () => {
      const query = chain(MOCK_ROOMS.slice(0, 3));
      roomModel.find.mockReturnValue(query);

      const result = await service.listRoomsByBranch(BRANCH_A);

      expect(roomModel.find).toHaveBeenCalledWith({ branchId: BRANCH_A });
      expect(query.sort).toHaveBeenCalledWith({ roomName: 1 });
      expect(result.map((r) => r.roomId)).toEqual(['r-1', 'r-2', 'r-3']);
      expect(result[2].roomStatus).toBe('MAINTENANCE');
    });

    it('does not leak rooms of other branches', async () => {
      const result = await service.listRoomsByBranch(BRANCH_B);

      expect(result.map((r) => r.roomId)).toEqual(['r-9']);
    });

    it('returns empty array for branch without rooms', async () => {
      await expect(service.listRoomsByBranch('none')).resolves.toEqual([]);
    });

    it('propagates database errors', async () => {
      roomModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('mongo down')),
      });

      await expect(service.listRoomsByBranch(BRANCH_A)).rejects.toThrow(
        'mongo down',
      );
    });
  });

  describe('getRoomSchedulingInfo', () => {
    it('returns room info', async () => {
      const result = await service.getRoomSchedulingInfo('r-1');

      expect(roomModel.findById).toHaveBeenCalledWith('r-1');
      expect(result?.roomId).toBe('r-1');
      expect(result?.roomName).toBe('Phòng 1');
    });

    it('returns null when room does not exist', async () => {
      await expect(service.getRoomSchedulingInfo('r-zzz')).resolves.toBeNull();
    });
  });

  describe('getRoomSchedulingInfos', () => {
    it('queries with $in and maps results', async () => {
      const result = await service.getRoomSchedulingInfos(['r-1', 'r-9']);

      expect(roomModel.find).toHaveBeenCalledWith({
        _id: { $in: ['r-1', 'r-9'] },
      });
      expect(result.map((r) => r.roomId)).toEqual(['r-1', 'r-9']);
    });

    it('returns empty array without querying for empty input', async () => {
      await expect(service.getRoomSchedulingInfos([])).resolves.toEqual([]);
      expect(roomModel.find).not.toHaveBeenCalled();
    });
  });
});
