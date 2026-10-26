import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PublicShowtimeQueryService } from './public-showtime-query.service';
import { Showtime } from '../../domain/schemas/showtime.schema';
import { Room } from '../../../room/domain/schemas/room.schema';
import { Movie } from '../../../movie/domain/schemas/movie.schema';
import { Genre } from '../../../movie/domain/schemas/genre.schema';
import { SeatShowtime } from '../../domain/schemas/seat-showtime.schema';
import { Seat } from '../../../room/domain/schemas/seat.schema';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import { SeatStatus } from '../../../room/domain/enums/seat-status.enum';
import { Branch } from '../../../branch/domain/schemas/branch.schema';

const mockQueryChain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

describe('PublicShowtimeQueryService', () => {
  let service: PublicShowtimeQueryService;
  const showtimeModel = { find: jest.fn() };
  const roomModel = { find: jest.fn() };
  const movieModel = { find: jest.fn() };
  const genreModel = { find: jest.fn() };
  const seatShowtimeModel = { find: jest.fn() };
  const seatModel = { find: jest.fn() };
  const branchModel = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicShowtimeQueryService,
        { provide: getModelToken(Showtime.name), useValue: showtimeModel },
        { provide: getModelToken(Room.name), useValue: roomModel },
        { provide: getModelToken(Movie.name), useValue: movieModel },
        { provide: getModelToken(Genre.name), useValue: genreModel },
        {
          provide: getModelToken(SeatShowtime.name),
          useValue: seatShowtimeModel,
        },
        { provide: getModelToken(Seat.name), useValue: seatModel },
        { provide: getModelToken(Branch.name), useValue: branchModel },
      ],
    }).compile();

    service = moduleRef.get(PublicShowtimeQueryService);
  });

  it('trả về mảng rỗng khi chi nhánh không có phòng khả dụng', async () => {
    roomModel.find.mockReturnValue(mockQueryChain([]));

    const result = await service.getPublicShowtimes({
      branchId: 'branch-empty',
    });

    expect(result).toEqual([]);
    expect(showtimeModel.find).not.toHaveBeenCalled();
  });

  it('lấy danh sách suất chiếu công khai kèm đầy đủ thông tin phim, phòng và ghế', async () => {
    const mockRooms = [
      {
        roomId: 'room-01',
        roomName: 'Cinema 01 (2D Phụ Đề)',
        branchId: 'branch-cantavil',
      },
    ];
    roomModel.find.mockReturnValue(mockQueryChain(mockRooms));
    branchModel.find.mockReturnValue(
      mockQueryChain([
        {
          branchId: 'branch-cantavil',
          branchName: 'Lotte Cinema Cantavil',
        },
      ]),
    );

    const mockShowtimes = [
      {
        showtimeId: 'st-01',
        movieId: 'm-01',
        roomId: 'room-01',
        startTime: new Date('2026-10-26T09:00:00Z'),
        endTime: new Date('2026-10-26T11:15:00Z'),
        basePrice: 90000,
      },
    ];
    showtimeModel.find.mockReturnValue(mockQueryChain(mockShowtimes));

    const mockMovies = [
      {
        movieId: 'm-01',
        movieName: 'TRẠI BUÔN NGƯỜI',
        duration: 135,
        posterUrl: '/posters/12349.jpg',
        genreIds: ['g-horror', 'g-thriller'],
      },
    ];
    movieModel.find.mockReturnValue(mockQueryChain(mockMovies));

    const mockGenres = [
      { genreId: 'g-horror', genreName: 'Kinh Dị' },
      { genreId: 'g-thriller', genreName: 'Giật Gân' },
    ];
    genreModel.find.mockReturnValue(mockQueryChain(mockGenres));

    const mockSeatShowtimes = [
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.EMPTY },
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.BOOKED },
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.EMPTY },
    ];
    seatShowtimeModel.find.mockReturnValue(mockQueryChain(mockSeatShowtimes));

    const result = await service.getPublicShowtimes({
      branchId: 'branch-cantavil',
      date: '2026-10-26',
    });

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.showtimeId).toBe('st-01');
    expect(item.movieName).toBe('TRẠI BUÔN NGƯỜI');
    expect(item.duration).toBe(135);
    expect(item.posterUrl).toBe('/posters/12349.jpg');
    expect(item.genreNames).toEqual(['Kinh Dị', 'Giật Gân']);
    expect(item.roomName).toBe('Cinema 01 (2D Phụ Đề)');
    expect(item.branchId).toBe('branch-cantavil');
    expect(item.branchName).toBe('Lotte Cinema Cantavil');
    expect(item.basePrice).toBe(90000);
    expect(item.totalSeats).toBe(3);
    expect(item.availableSeats).toBe(2);
  });

  it('fallback tính số ghế từ SeatModel khi suất chiếu chưa có bản ghi SeatShowtime', async () => {
    roomModel.find.mockReturnValue(
      mockQueryChain([
        {
          roomId: 'room-02',
          roomName: 'Cinema 02',
          branchId: 'branch-govap',
        },
      ]),
    );
    branchModel.find.mockReturnValue(
      mockQueryChain([
        {
          branchId: 'branch-govap',
          branchName: 'Lotte Cinema Gò Vấp',
        },
      ]),
    );
    showtimeModel.find.mockReturnValue(
      mockQueryChain([
        {
          showtimeId: 'st-02',
          movieId: 'm-02',
          roomId: 'room-02',
          startTime: new Date('2026-10-26T14:00:00Z'),
          endTime: new Date('2026-10-26T16:00:00Z'),
          basePrice: 100000,
        },
      ]),
    );
    movieModel.find.mockReturnValue(
      mockQueryChain([
        {
          movieId: 'm-02',
          movieName: 'ÚT LAN 2',
          duration: 107,
          genreIds: [],
        },
      ]),
    );
    seatShowtimeModel.find.mockReturnValue(mockQueryChain([]));
    seatModel.find.mockReturnValue(
      mockQueryChain([
        { roomId: 'room-02', status: SeatStatus.AVAILABLE },
        { roomId: 'room-02', status: SeatStatus.AVAILABLE },
        { roomId: 'room-02', status: SeatStatus.MAINTENANCE },
      ]),
    );

    const result = await service.getPublicShowtimes({
      branchId: 'branch-govap',
      date: '2026-10-26',
    });

    expect(result).toHaveLength(1);
    expect(result[0].totalSeats).toBe(3);
    expect(result[0].availableSeats).toBe(2);
  });
});
