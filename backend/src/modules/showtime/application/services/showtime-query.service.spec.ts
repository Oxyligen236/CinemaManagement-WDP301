import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ShowtimeQueryService } from './showtime-query.service';
import { Room } from '../../../room/domain/schemas/room.schema';
import { Showtime } from '../../domain/schemas/showtime.schema';

const chain = (result: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const ST_ID = new Types.ObjectId();
const MOVIE_ID = new Types.ObjectId();
const ROOM_ID = new Types.ObjectId();

const doc = (o: Record<string, unknown> = {}) => ({
  _id: ST_ID,
  movieId: MOVIE_ID,
  roomId: ROOM_ID,
  startTime: new Date('2026-10-25T02:30:00Z'),
  endTime: new Date('2026-10-25T05:16:00Z'),
  basePrice: 75000,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...o,
});

describe('ShowtimeQueryService', () => {
  let service: ShowtimeQueryService;
  const showtimeModel = {
    exists: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShowtimeQueryService,
        { provide: getModelToken(Showtime.name), useValue: showtimeModel },
        { provide: getModelToken(Room.name), useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(ShowtimeQueryService);
  });

  it('trả về true khi có suất chiếu chưa kết thúc', async () => {
    showtimeModel.exists.mockResolvedValue({ _id: 'x' });
    await expect(service.hasActiveShowtimes('m1')).resolves.toBe(true);
    const [arg] = showtimeModel.exists.mock.calls[0] as [
      { movieId: string; endTime: { $gte: Date } },
    ];
    expect(arg.movieId).toBe('m1');
    expect(arg.endTime.$gte).toBeInstanceOf(Date);
  });

  it('trả về false khi không có suất chiếu', async () => {
    showtimeModel.exists.mockResolvedValue(null);
    await expect(service.hasActiveShowtimes('m2')).resolves.toBe(false);
  });

  describe('searchShowtimesByRooms', () => {
    it('roomIds rỗng -> Page rỗng, không truy vấn', async () => {
      const page = await service.searchShowtimesByRooms([], {}, 1, 10);
      expect(page.items).toEqual([]);
      expect(page.total).toBe(0);
      expect(showtimeModel.find).not.toHaveBeenCalled();
      expect(showtimeModel.countDocuments).not.toHaveBeenCalled();
    });

    it('lọc from/to -> $gte/$lt và sắp xếp startTime tăng dần', async () => {
      const findChain = chain([doc()]);
      showtimeModel.find.mockReturnValue(findChain);
      showtimeModel.countDocuments.mockReturnValue(chain(1));
      const from = new Date('2026-10-24T17:00:00Z');
      const to = new Date('2026-10-25T17:00:00Z');

      const page = await service.searchShowtimesByRooms(
        ['r-1', 'r-2'],
        { movieId: 'm-1', from, to },
        2,
        5,
      );

      expect(showtimeModel.find).toHaveBeenCalledWith({
        roomId: { $in: ['r-1', 'r-2'] },
        movieId: 'm-1',
        startTime: { $gte: from, $lt: to },
      });
      expect(findChain.sort).toHaveBeenCalledWith({ startTime: 1 });
      expect(findChain.skip).toHaveBeenCalledWith(5);
      expect(findChain.limit).toHaveBeenCalledWith(5);
      expect(page.total).toBe(1);
      expect(page.page).toBe(2);
    });

    it('roomId thuộc roomIds -> chỉ phòng đó', async () => {
      showtimeModel.find.mockReturnValue(chain([]));
      showtimeModel.countDocuments.mockReturnValue(chain(0));
      await service.searchShowtimesByRooms(
        ['r-1', 'r-2'],
        { roomId: 'r-2' },
        1,
        10,
      );
      expect(showtimeModel.find).toHaveBeenCalledWith({
        roomId: { $in: ['r-2'] },
      });
    });

    it('roomId không thuộc roomIds -> Page rỗng, không truy vấn', async () => {
      const page = await service.searchShowtimesByRooms(
        ['r-1'],
        { roomId: 'r-9' },
        1,
        10,
      );
      expect(page.items).toEqual([]);
      expect(showtimeModel.find).not.toHaveBeenCalled();
    });

    it('map 2 mảng snapshot; suất cũ không có -> []', async () => {
      const ruleId = new Types.ObjectId();
      showtimeModel.find.mockReturnValue(
        chain([
          doc({
            seatPriceSelections: [{ seatType: 'VIP', ruleId, multiplier: 1.5 }],
            dayPriceSelections: [
              { dayType: 'WEEKEND', ruleId: null, multiplier: 1 },
            ],
          }),
          doc({ _id: new Types.ObjectId() }),
        ]),
      );
      showtimeModel.countDocuments.mockReturnValue(chain(2));

      const page = await service.searchShowtimesByRooms(['r-1'], {}, 1, 10);

      expect(page.items[0].seatPriceSelections).toEqual([
        { seatType: 'VIP', ruleId: ruleId.toString(), multiplier: 1.5 },
      ]);
      expect(page.items[0].dayPriceSelections).toEqual([
        { dayType: 'WEEKEND', ruleId: null, multiplier: 1 },
      ]);
      expect(page.items[1].seatPriceSelections).toEqual([]);
      expect(page.items[1].dayPriceSelections).toEqual([]);
    });
  });
});
