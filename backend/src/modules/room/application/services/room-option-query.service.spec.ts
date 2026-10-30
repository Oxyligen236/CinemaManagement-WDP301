import { RoomOptionQueryService } from './room-option-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const MOCK_ROOMS = [
  {
    id: 'r-1',
    roomName: 'Phòng 1',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    id: 'r-2',
    roomName: 'Phòng 2',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    id: 'r-3',
    roomName: 'Phòng 3',
    roomStatus: 'MAINTENANCE',
    branchId: BRANCH_A,
  },
  {
    id: 'r-9',
    roomName: 'Phòng X',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_B,
  },
];

describe('RoomOptionQueryService', () => {
  let service: RoomOptionQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      room: {
        findMany: jest.fn((args?: { where?: any; orderBy?: any }) => {
          let list = [...MOCK_ROOMS];
          if (args?.where?.branchId) {
            list = list.filter((r) => r.branchId === args.where.branchId);
          }
          if (args?.where?.id?.in) {
            list = list.filter((r) => args.where.id.in.includes(r.id));
          }
          return Promise.resolve(list);
        }),
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(MOCK_ROOMS.find((r) => r.id === args.where.id) ?? null),
        ),
      },
    };

    service = new RoomOptionQueryService(mockPrisma as unknown as PrismaService);
  });

  describe('listRoomsByBranch', () => {
    it('filters by branch, sorts by roomName and keeps non-available rooms', async () => {
      const result = await service.listRoomsByBranch(BRANCH_A);

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { branchId: BRANCH_A },
        orderBy: { roomName: 'asc' },
      });
      expect(result.map((r) => r.roomId)).toEqual(['r-1', 'r-2', 'r-3']);
      expect(result[2].roomStatus).toBe('MAINTENANCE');
    });

    it('does not leak rooms of other branches', async () => {
      const result = await service.listRoomsByBranch(BRANCH_B);

      expect(result).toEqual([
        {
          roomId: 'r-9',
          roomName: 'Phòng X',
          roomStatus: 'AVAILABLE',
          branchId: BRANCH_B,
        },
      ]);
    });

    it('returns empty array for branch without rooms', async () => {
      await expect(service.listRoomsByBranch('none')).resolves.toEqual([]);
    });

    it('propagates database errors', async () => {
      mockPrisma.room.findMany.mockRejectedValue(new Error('db down'));

      await expect(service.listRoomsByBranch(BRANCH_A)).rejects.toThrow('db down');
    });
  });

  describe('getRoomSchedulingInfo', () => {
    it('returns room info', async () => {
      const result = await service.getRoomSchedulingInfo('r-1');

      expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'r-1' },
      });
      expect(result).toEqual({
        roomId: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: 'AVAILABLE',
        branchId: BRANCH_A,
      });
    });

    it('returns null when room does not exist', async () => {
      await expect(service.getRoomSchedulingInfo('r-zzz')).resolves.toBeNull();
    });
  });

  describe('getRoomSchedulingInfos', () => {
    it('queries with in and maps results', async () => {
      const result = await service.getRoomSchedulingInfos(['r-1', 'r-9']);

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['r-1', 'r-9'] },
        },
      });
      expect(result.map((r) => r.roomId)).toEqual(['r-1', 'r-9']);
    });

    it('returns empty array without querying for empty input', async () => {
      await expect(service.getRoomSchedulingInfos([])).resolves.toEqual([]);
      expect(mockPrisma.room.findMany).not.toHaveBeenCalled();
    });
  });
});
