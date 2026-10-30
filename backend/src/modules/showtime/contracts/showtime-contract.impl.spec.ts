import { ShowtimeContractImpl } from './showtime-contract.impl';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('ShowtimeContractImpl', () => {
  let contract: ShowtimeContractImpl;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      seatShowtime: {
        findUnique: jest.fn(),
      },
    };

    contract = new ShowtimeContractImpl(mockPrisma as unknown as PrismaService);
  });

  it('trả về null nếu không tìm thấy seatShowtime', async () => {
    mockPrisma.seatShowtime.findUnique.mockResolvedValue(null);

    const result = await contract.getSeatShowtimeDetail('invalid-id');
    expect(result).toBeNull();
  });

  it('trả về null nếu không tìm thấy showtime hoặc seat', async () => {
    mockPrisma.seatShowtime.findUnique.mockResolvedValue({
      id: 'sst-1',
      showtime: null,
      seat: { id: 'seat-1' },
    });

    const result = await contract.getSeatShowtimeDetail('sst-1');
    expect(result).toBeNull();
  });

  it('trả về đầy đủ SeatShowtimeDetailDto khi dữ liệu hợp lệ', async () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 7200000);

    mockPrisma.seatShowtime.findUnique.mockResolvedValue({
      id: 'sst-1',
      showtime: {
        id: 'st-1',
        movieId: 'm-1',
        startTime,
        endTime,
        basePrice: 90000,
        movie: {
          id: 'm-1',
          movieName: 'Lật Mặt 7',
        },
        room: {
          id: 'r-1',
          roomName: 'Cinema 1',
          branchId: 'b-1',
          branch: {
            id: 'b-1',
            branchName: 'Chi nhánh Hà Đông',
            address: '123 Quang Trung, Hà Đông, Hà Nội',
          },
        },
      },
      seat: {
        id: 'seat-1',
        rowPosition: 'C',
        columnPosition: 5,
      },
    });

    const result = await contract.getSeatShowtimeDetail('sst-1');

    expect(result).toEqual({
      seatShowtimeId: 'sst-1',
      showtimeId: 'st-1',
      movieId: 'm-1',
      movieTitle: 'Lật Mặt 7',
      roomId: 'r-1',
      roomName: 'Cinema 1',
      seatId: 'seat-1',
      rowPosition: 'C',
      columnPosition: 5,
      price: 90000,
      startTime,
      endTime,
      branchId: 'b-1',
      branchName: 'Chi nhánh Hà Đông',
      branchAddress: '123 Quang Trung, Hà Đông, Hà Nội',
    });
  });
});
