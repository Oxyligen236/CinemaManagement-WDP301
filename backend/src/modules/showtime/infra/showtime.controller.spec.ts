import { Test, TestingModule } from '@nestjs/testing';
import { ShowtimeController } from './showtime.controller';
import { ShowtimeQueryService } from '../application/services/showtime-query.service';
import { SeatShowtimeQueryService } from '../application/services/seat-showtime-query.service';
import { PublicShowtimeQueryService } from '../application/services/public-showtime-query.service';

describe('ShowtimeController', () => {
  let controller: ShowtimeController;
  let showtimeQueryService: jest.Mocked<ShowtimeQueryService>;
  let seatShowtimeQueryService: jest.Mocked<SeatShowtimeQueryService>;
  let publicShowtimeQueryService: jest.Mocked<PublicShowtimeQueryService>;

  beforeEach(async () => {
    showtimeQueryService = {
      searchShowtimes: jest.fn(),
      getShowtimeDetail: jest.fn(),
    } as unknown as jest.Mocked<ShowtimeQueryService>;
    seatShowtimeQueryService = {
      getShowtimeSeats: jest.fn(),
    } as unknown as jest.Mocked<SeatShowtimeQueryService>;
    publicShowtimeQueryService = {
      getPublicShowtimes: jest.fn(),
    } as unknown as jest.Mocked<PublicShowtimeQueryService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShowtimeController],
      providers: [
        { provide: ShowtimeQueryService, useValue: showtimeQueryService },
        {
          provide: SeatShowtimeQueryService,
          useValue: seatShowtimeQueryService,
        },
        {
          provide: PublicShowtimeQueryService,
          useValue: publicShowtimeQueryService,
        },
      ],
    }).compile();

    controller = module.get(ShowtimeController);
  });

  it('delegates getPublicShowtimes to PublicShowtimeQueryService', async () => {
    const query = { branchId: 'b-1', date: '2026-11-15' };
    publicShowtimeQueryService.getPublicShowtimes.mockResolvedValue([]);

    await expect(controller.getPublicShowtimes(query)).resolves.toEqual([]);
    expect(publicShowtimeQueryService.getPublicShowtimes).toHaveBeenCalledWith(
      query,
    );
  });

  it('delegates searchShowtimes to ShowtimeQueryService', async () => {
    const query = { movieId: 'm-1', page: 1, limit: 10 };
    const page = { items: [], total: 0, page: 1, limit: 10 };
    showtimeQueryService.searchShowtimes.mockResolvedValue(page as any);

    await expect(controller.searchShowtimes(query)).resolves.toEqual(page);
    expect(showtimeQueryService.searchShowtimes).toHaveBeenCalledWith(query);
  });

  it('delegates getShowtimeDetail to ShowtimeQueryService', async () => {
    const detail = { showtimeId: 'st-1' };
    showtimeQueryService.getShowtimeDetail.mockResolvedValue(detail as any);

    await expect(controller.getShowtimeDetail('st-1')).resolves.toEqual(detail);
    expect(showtimeQueryService.getShowtimeDetail).toHaveBeenCalledWith('st-1');
  });

  it('delegates getShowtimeSeats to SeatShowtimeQueryService', async () => {
    seatShowtimeQueryService.getShowtimeSeats.mockResolvedValue([]);

    await expect(controller.getShowtimeSeats('st-1')).resolves.toEqual([]);
    expect(seatShowtimeQueryService.getShowtimeSeats).toHaveBeenCalledWith(
      'st-1',
    );
  });
});
