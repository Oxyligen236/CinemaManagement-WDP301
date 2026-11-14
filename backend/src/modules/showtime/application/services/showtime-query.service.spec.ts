import { NotFoundException } from '@nestjs/common';
import { ShowtimeQueryService } from './showtime-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const doc = (o: Record<string, unknown> = {}) => ({
  id: 'st-1',
  movieId: 'm-1',
  roomId: 'r-1',
  startTime: new Date('2026-10-25T02:30:00Z'),
  endTime: new Date('2026-10-25T05:16:00Z'),
  basePrice: 75000,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...o,
});

describe('ShowtimeQueryService', () => {
  let service: ShowtimeQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      showtime: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      room: {
        findMany: jest.fn(),
      },
    };

    service = new ShowtimeQueryService(mockPrisma);
  });

  it('trả về true khi có suất chiếu chưa kết thúc', async () => {
    mockPrisma.showtime.findFirst.mockResolvedValue({ id: 'x' });
    await expect(service.hasActiveShowtimes('m1')).resolves.toBe(true);
    const [arg] = mockPrisma.showtime.findFirst.mock.calls[0] as [
      { where: { movieId: string; endTime: { gte: Date } } },
    ];
    expect(arg.where.movieId).toBe('m1');
    expect(arg.where.endTime.gte).toBeInstanceOf(Date);
  });

  it('trả về false khi không có suất chiếu', async () => {
    mockPrisma.showtime.findFirst.mockResolvedValue(null);
    await expect(service.hasActiveShowtimes('m2')).resolves.toBe(false);
  });

  describe('searchShowtimesByRooms', () => {
    it('lọc from/to -> gte/lte và sắp xếp startTime tăng dần', async () => {
      mockPrisma.showtime.findMany.mockResolvedValue([doc()]);
      mockPrisma.showtime.count.mockResolvedValue(1);
      const from = new Date('2026-10-24T17:00:00Z');
      const to = new Date('2026-10-25T17:00:00Z');

      const page = await service.searchShowtimesByRooms(
        ['r-1', 'r-2'],
        { movieId: 'm-1', from, to },
        2,
        5,
      );

      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith({
        where: {
          roomId: { in: ['r-1', 'r-2'] },
          movieId: 'm-1',
          startTime: { gte: from, lte: to },
        },
        orderBy: { startTime: 'asc' },
        skip: 5,
        take: 5,
      });
      expect(page.total).toBe(1);
      expect(page.page).toBe(2);
    });

    it('roomId thuộc roomIds -> chỉ phòng đó', async () => {
      mockPrisma.showtime.findMany.mockResolvedValue([]);
      mockPrisma.showtime.count.mockResolvedValue(0);

      await service.searchShowtimesByRooms(
        ['r-1', 'r-2'],
        { roomId: 'r-2' },
        1,
        10,
      );

      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomId: { in: ['r-2'] },
          }),
        }),
      );
    });

    it('map 2 mảng snapshot; suất cũ không có -> []', async () => {
      mockPrisma.showtime.findMany.mockResolvedValue([
        doc({
          seatPriceSelections: [
            { seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 },
          ],
          dayPriceSelections: [
            { dayType: 'WEEKEND', ruleId: null, multiplier: 1 },
          ],
        }),
        doc({ id: 'st-old' }),
      ]);
      mockPrisma.showtime.count.mockResolvedValue(2);

      const page = await service.searchShowtimesByRooms(['r-1'], {}, 1, 10);

      expect(page.items[0].seatPriceSelections).toEqual([
        { seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 },
      ]);
      expect(page.items[0].dayPriceSelections).toEqual([
        { dayType: 'WEEKEND', ruleId: null, multiplier: 1 },
      ]);
      expect(page.items[1].seatPriceSelections).toEqual([]);
      expect(page.items[1].dayPriceSelections).toEqual([]);
    });

    it('dùng page=1, limit=10 mặc định khi không truyền phân trang', async () => {
      mockPrisma.showtime.findMany.mockResolvedValue([]);
      mockPrisma.showtime.count.mockResolvedValue(0);

      await service.searchShowtimesByRooms(['r-1'], {});

      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith({
        where: { roomId: { in: ['r-1'] } },
        orderBy: { startTime: 'asc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('searchShowtimes', () => {
    it('lọc theo movieId, branchId kết hợp roomId và date', async () => {
      mockPrisma.room.findMany.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }]);
      mockPrisma.showtime.findMany.mockResolvedValue([doc()]);
      mockPrisma.showtime.count.mockResolvedValue(1);

      const page = await service.searchShowtimes({
        movieId: 'm-1',
        branchId: 'b-1',
        roomId: 'r-2',
        date: '2026-10-25',
      });

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { branchId: 'b-1' },
        select: { id: true },
      });
      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith({
        where: {
          movieId: 'm-1',
          roomId: { in: ['r-2'] },
          startTime: {
            gte: new Date('2026-10-25T00:00:00.000Z'),
            lt: new Date('2026-10-26T00:00:00.000Z'),
          },
        },
        orderBy: { startTime: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(page.items).toHaveLength(1);
    });

    it('lọc theo branchId (không có roomId) và from/to', async () => {
      mockPrisma.room.findMany.mockResolvedValue([{ id: 'r-1' }]);
      mockPrisma.showtime.findMany.mockResolvedValue([]);
      mockPrisma.showtime.count.mockResolvedValue(0);

      await service.searchShowtimes({
        branchId: 'b-1',
        from: '2026-10-24T00:00:00.000Z',
        to: '2026-10-26T00:00:00.000Z',
        page: 2,
        limit: 5,
      });

      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith({
        where: {
          roomId: { in: ['r-1'] },
          startTime: {
            gte: new Date('2026-10-24T00:00:00.000Z'),
            lte: new Date('2026-10-26T00:00:00.000Z'),
          },
        },
        orderBy: { startTime: 'desc' },
        skip: 5,
        take: 5,
      });
    });

    it('lọc theo roomId đơn lẻ khi không có branchId và không có filter thời gian', async () => {
      mockPrisma.showtime.findMany.mockResolvedValue([]);
      mockPrisma.showtime.count.mockResolvedValue(0);

      await service.searchShowtimes({ roomId: 'r-9' });

      expect(mockPrisma.room.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith({
        where: { roomId: 'r-9' },
        orderBy: { startTime: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('getShowtimeDetail', () => {
    it('trả về ShowtimeResDto khi tìm thấy suất chiếu', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(doc());

      const res = await service.getShowtimeDetail('st-1');

      expect(res.showtimeId).toBe('st-1');
    });

    it('ném NotFoundException khi không tìm thấy suất chiếu', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(null);

      await expect(service.getShowtimeDetail('missing')).rejects.toThrow(
        new NotFoundException('Showtime not found'),
      );
    });
  });
});
