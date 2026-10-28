import { ShowtimeContractImpl } from './showtime-contract.impl';

describe('ShowtimeContractImpl', () => {
  let contract: ShowtimeContractImpl;
  let mockSeatShowtimeModel: { findOne: jest.Mock };
  let mockShowtimeModel: { findOne: jest.Mock };
  let mockMovieModel: { findOne: jest.Mock };
  let mockRoomModel: { findOne: jest.Mock };
  let mockSeatModel: { findOne: jest.Mock };
  let mockBranchModel: { findOne: jest.Mock };

  beforeEach(() => {
    mockSeatShowtimeModel = { findOne: jest.fn() };
    mockShowtimeModel = { findOne: jest.fn() };
    mockMovieModel = { findOne: jest.fn() };
    mockRoomModel = { findOne: jest.fn() };
    mockSeatModel = { findOne: jest.fn() };
    mockBranchModel = { findOne: jest.fn() };

    contract = new ShowtimeContractImpl(
      mockSeatShowtimeModel as any,
      mockShowtimeModel as any,
      mockMovieModel as any,
      mockRoomModel as any,
      mockSeatModel as any,
      mockBranchModel as any,
    );
  });

  it('trả về null nếu không tìm thấy seatShowtime', async () => {
    mockSeatShowtimeModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    const result = await contract.getSeatShowtimeDetail('invalid-id');
    expect(result).toBeNull();
  });

  it('trả về null nếu không tìm thấy showtime hoặc seat', async () => {
    mockSeatShowtimeModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-1',
          seatId: 'seat-1',
        }),
      }),
    });
    mockShowtimeModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });
    mockSeatModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ seatId: 'seat-1' }),
      }),
    });

    const result = await contract.getSeatShowtimeDetail('sst-1');
    expect(result).toBeNull();
  });

  it('trả về đầy đủ SeatShowtimeDetailDto khi dữ liệu hợp lệ', async () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 7200000);

    mockSeatShowtimeModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-1',
          seatId: 'seat-1',
        }),
      }),
    });
    mockShowtimeModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          showtimeId: 'st-1',
          movieId: 'm-1',
          roomId: 'room-1',
          basePrice: 90000,
          startTime,
          endTime,
        }),
      }),
    });
    mockSeatModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          seatId: 'seat-1',
          rowPosition: 'A',
          columnPosition: 1,
        }),
      }),
    });
    mockMovieModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          movieId: 'm-1',
          movieName: 'Conan Movie',
        }),
      }),
    });
    mockRoomModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomName: 'Cinema 1',
          branchId: 'branch-1',
        }),
      }),
    });
    mockBranchModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          branchId: 'branch-1',
          branchName: 'Chi nhánh Hà Nội',
          address: '123 Đường Cầu Giấy',
        }),
      }),
    });

    const result = await contract.getSeatShowtimeDetail('sst-1');
    expect(result).toEqual({
      seatShowtimeId: 'sst-1',
      showtimeId: 'st-1',
      movieId: 'm-1',
      movieTitle: 'Conan Movie',
      roomId: 'room-1',
      roomName: 'Cinema 1',
      seatId: 'seat-1',
      rowPosition: 'A',
      columnPosition: 1,
      price: 90000,
      startTime,
      endTime,
      branchId: 'branch-1',
      branchName: 'Chi nhánh Hà Nội',
      branchAddress: '123 Đường Cầu Giấy',
    });
  });
});
