import { PublicShowtimeQueryService } from './public-showtime-query.service';
import { RoomStatus, SeatStatus, SeatShowtimeStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('PublicShowtimeQueryService', () => {
  let service: PublicShowtimeQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      room: {
        findMany: jest.fn(),
      },
      showtime: {
        findMany: jest.fn(),
      },
      branch: {
        findMany: jest.fn(),
      },
      movie: {
        findMany: jest.fn(),
      },
      genre: {
        findMany: jest.fn(),
      },
      seatShowtime: {
        findMany: jest.fn(),
      },
      seat: {
        findMany: jest.fn(),
      },
    };

    service = new PublicShowtimeQueryService(mockPrisma);
  });

  it('trả về mảng rỗng khi chi nhánh không có phòng khả dụng', async () => {
    mockPrisma.room.findMany.mockResolvedValue([]);

    const result = await service.getPublicShowtimes({
      branchId: 'branch-empty',
    });

    expect(result).toEqual([]);
    expect(mockPrisma.showtime.findMany).not.toHaveBeenCalled();
  });

  it('lấy danh sách suất chiếu công khai kèm đầy đủ thông tin phim, phòng và ghế', async () => {
    const mockRooms = [
      {
        id: 'room-01',
        roomName: 'Cinema 01 (2D Phụ Đề)',
        branchId: 'branch-cantavil',
      },
    ];
    mockPrisma.room.findMany.mockResolvedValue(mockRooms);
    mockPrisma.branch.findMany.mockResolvedValue([
      {
        id: 'branch-cantavil',
        branchName: 'Lotte Cinema Cantavil',
      },
    ]);

    const mockShowtimes = [
      {
        id: 'st-01',
        movieId: 'm-01',
        roomId: 'room-01',
        startTime: new Date('2026-10-26T09:00:00Z'),
        endTime: new Date('2026-10-26T11:15:00Z'),
        basePrice: 90000,
      },
    ];
    mockPrisma.showtime.findMany.mockResolvedValue(mockShowtimes);

    const mockMovies = [
      {
        id: 'm-01',
        movieName: 'TRẠI BUÔN NGƯỜI',
        duration: 135,
        posterKey: '/posters/12349.jpg',
        genreIds: ['g-horror', 'g-thriller'],
      },
    ];
    mockPrisma.movie.findMany.mockResolvedValue(mockMovies);

    const mockGenres = [
      { id: 'g-horror', genreName: 'Kinh Dị' },
      { id: 'g-thriller', genreName: 'Giật Gân' },
    ];
    mockPrisma.genre.findMany.mockResolvedValue(mockGenres);

    const mockSeatShowtimes = [
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.EMPTY },
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.BOOKED },
      { showtimeId: 'st-01', seatStatus: SeatShowtimeStatus.EMPTY },
    ];
    mockPrisma.seatShowtime.findMany.mockResolvedValue(mockSeatShowtimes);

    const result = await service.getPublicShowtimes({
      branchId: 'branch-cantavil',
      date: '2026-10-26',
    });

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.showtimeId).toBe('st-01');
    expect(item.movieName).toBe('TRẠI BUÔN NGƯỜI');
    expect(item.duration).toBe(135);
    expect(item.genreNames).toEqual(['Kinh Dị', 'Giật Gân']);
    expect(item.roomName).toBe('Cinema 01 (2D Phụ Đề)');
    expect(item.branchId).toBe('branch-cantavil');
    expect(item.branchName).toBe('Lotte Cinema Cantavil');
    expect(item.basePrice).toBe(90000);
    expect(item.totalSeats).toBe(3);
    expect(item.availableSeats).toBe(2);
  });

  it('fallback tính số ghế từ SeatModel khi suất chiếu chưa có bản ghi SeatShowtime', async () => {
    mockPrisma.room.findMany.mockResolvedValue([
      {
        id: 'room-02',
        roomName: 'Cinema 02',
        branchId: 'branch-govap',
      },
    ]);
    mockPrisma.branch.findMany.mockResolvedValue([
      {
        id: 'branch-govap',
        branchName: 'Lotte Cinema Gò Vấp',
      },
    ]);
    mockPrisma.showtime.findMany.mockResolvedValue([
      {
        id: 'st-02',
        movieId: 'm-02',
        roomId: 'room-02',
        startTime: new Date('2026-10-26T14:00:00Z'),
        endTime: new Date('2026-10-26T16:00:00Z'),
        basePrice: 100000,
      },
    ]);
    mockPrisma.movie.findMany.mockResolvedValue([
      {
        id: 'm-02',
        movieName: 'ÚT LAN 2',
        duration: 107,
        genreIds: [],
      },
    ]);
    mockPrisma.seatShowtime.findMany.mockResolvedValue([]);
    mockPrisma.seat.findMany.mockResolvedValue([
      { roomId: 'room-02', status: SeatStatus.AVAILABLE },
      { roomId: 'room-02', status: SeatStatus.AVAILABLE },
      { roomId: 'room-02', status: SeatStatus.MAINTENANCE },
    ]);

    const result = await service.getPublicShowtimes({
      branchId: 'branch-govap',
      date: '2026-10-26',
    });

    expect(result).toHaveLength(1);
    expect(result[0].totalSeats).toBe(3);
    expect(result[0].availableSeats).toBe(2);
  });
});
