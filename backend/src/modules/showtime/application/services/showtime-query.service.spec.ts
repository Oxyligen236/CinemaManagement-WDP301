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

    service = new ShowtimeQueryService(mockPrisma as unknown as PrismaService);
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
  });
});
