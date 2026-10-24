import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ShowtimeQueryService } from './showtime-query.service';
import { Room } from '../../../room/domain/schemas/room.schema';
import { Showtime } from '../../domain/schemas/showtime.schema';

describe('ShowtimeQueryService', () => {
  let service: ShowtimeQueryService;
  const showtimeModel = { exists: jest.fn() };

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
});
