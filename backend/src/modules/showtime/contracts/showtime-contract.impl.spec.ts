import { Types } from 'mongoose';
import { ShowtimeContractImpl } from './showtime-contract.impl';

describe('ShowtimeContractImpl', () => {
  let contract: ShowtimeContractImpl;
  let mockSeatShowtimeModel: { findById: jest.Mock };
  let mockShowtimeModel: { findById: jest.Mock };
  let mockMovieModel: { findById: jest.Mock };
  let mockRoomModel: { findById: jest.Mock };
  let mockSeatModel: { findById: jest.Mock };
  let mockBranchModel: { findById: jest.Mock };

  beforeEach(() => {
    mockSeatShowtimeModel = { findById: jest.fn() };
    mockShowtimeModel = { findById: jest.fn() };
    mockMovieModel = { findById: jest.fn() };
    mockRoomModel = { findById: jest.fn() };
    mockSeatModel = { findById: jest.fn() };
    mockBranchModel = { findById: jest.fn() };

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
    mockSeatShowtimeModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    const sstId = new Types.ObjectId().toString();
    const result = await contract.getSeatShowtimeDetail(sstId);
    expect(result).toBeNull();
  });

  it('trả về null nếu không tìm thấy showtime hoặc seat', async () => {
    const sstObjId = new Types.ObjectId();
    const stObjId = new Types.ObjectId();
    const seatObjId = new Types.ObjectId();

    mockSeatShowtimeModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sstObjId,
          showtimeId: stObjId,
          seatId: seatObjId,
        }),
      }),
    });
    mockShowtimeModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });
    mockSeatModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: seatObjId }),
      }),
    });

    const result = await contract.getSeatShowtimeDetail(sstObjId.toString());
    expect(result).toBeNull();
  });

  it('trả về đầy đủ SeatShowtimeDetailDto khi dữ liệu hợp lệ', async () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 7200000);
    const sstObjId = new Types.ObjectId();
    const stObjId = new Types.ObjectId();
    const seatObjId = new Types.ObjectId();
    const movieObjId = new Types.ObjectId();
    const roomObjId = new Types.ObjectId();
    const branchObjId = new Types.ObjectId();

    mockSeatShowtimeModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sstObjId,
          showtimeId: stObjId,
          seatId: seatObjId,
        }),
      }),
    });
    mockShowtimeModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: stObjId,
          movieId: movieObjId,
          roomId: roomObjId,
          basePrice: 90000,
          startTime,
          endTime,
        }),
      }),
    });
    mockSeatModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: seatObjId,
          rowPosition: 'A',
          columnPosition: 1,
        }),
      }),
    });
    mockMovieModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: movieObjId,
          movieName: 'Conan Movie',
        }),
      }),
    });
    mockRoomModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: roomObjId,
          roomName: 'Cinema 1',
          branchId: branchObjId,
        }),
      }),
    });
    mockBranchModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: branchObjId,
          branchName: 'Chi nhánh Hà Nội',
          address: '123 Đường Cầu Giấy',
        }),
      }),
    });

    const result = await contract.getSeatShowtimeDetail(sstObjId.toString());
    expect(result).toEqual({
      seatShowtimeId: sstObjId.toString(),
      showtimeId: stObjId.toString(),
      movieId: movieObjId.toString(),
      movieTitle: 'Conan Movie',
      roomId: roomObjId.toString(),
      roomName: 'Cinema 1',
      seatId: seatObjId.toString(),
      rowPosition: 'A',
      columnPosition: 1,
      price: 90000,
      startTime,
      endTime,
      branchId: branchObjId.toString(),
      branchName: 'Chi nhánh Hà Nội',
      branchAddress: '123 Đường Cầu Giấy',
    });
  });
});
