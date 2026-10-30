import { ConflictException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { MovieDocument } from '../../../movie/domain/schemas/movie.schema';
import type { RoomDocument } from '../../../room/domain/schemas/room.schema';
import type { SeatDocument } from '../../../room/domain/schemas/seat.schema';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import type { SeatShowtimeDocument } from '../../domain/schemas/seat-showtime.schema';
import type { ShowtimeDocument } from '../../domain/schemas/showtime.schema';
import { ShowtimeBookingService } from './showtime-booking.service';

const query = <T>(value: T) => ({
  lean: () => ({ exec: jest.fn().mockResolvedValue(value) }),
});

describe('ShowtimeBookingService', () => {
  let service: ShowtimeBookingService;
  let mockSeatShowtimeModel: {
    find: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
  };
  let mockShowtimeModel: {
    find: jest.Mock;
  };
  let mockSeatModel: {
    find: jest.Mock;
  };
  let mockRoomModel: {
    find: jest.Mock;
  };
  let mockMovieModel: {
    find: jest.Mock;
  };

  const SS1_ID = new Types.ObjectId();
  const SS2_ID = new Types.ObjectId();
  const ST1_ID = new Types.ObjectId();
  const S1_ID = new Types.ObjectId();
  const R1_ID = new Types.ObjectId();
  const M1_ID = new Types.ObjectId();

  beforeEach(() => {
    mockSeatShowtimeModel = {
      find: jest.fn(),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };
    mockShowtimeModel = { find: jest.fn() };
    mockSeatModel = { find: jest.fn() };
    mockRoomModel = { find: jest.fn() };
    mockMovieModel = { find: jest.fn() };

    service = new ShowtimeBookingService(
      mockSeatShowtimeModel as unknown as Model<SeatShowtimeDocument>,
      mockShowtimeModel as unknown as Model<ShowtimeDocument>,
      mockSeatModel as unknown as Model<SeatDocument>,
      mockRoomModel as unknown as Model<RoomDocument>,
      mockMovieModel as unknown as Model<MovieDocument>,
    );
  });

  it('reserves all EMPTY seats and returns details', async () => {
    mockSeatShowtimeModel.find.mockReturnValue(
      query([
        {
          _id: SS1_ID,
          showtimeId: ST1_ID,
          seatId: S1_ID,
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
      ]),
    );
    jest.spyOn(service, 'getSeatBookingDetails').mockResolvedValue([]);
    await expect(service.reserveSeats([SS1_ID.toString()])).resolves.toEqual(
      [],
    );
    expect(mockSeatShowtimeModel.updateOne).toHaveBeenCalledWith(
      {
        _id: SS1_ID,
        showtimeId: ST1_ID,
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
      { $set: { seatStatus: SeatShowtimeStatus.RESERVED } },
    );
  });

  it.each([SeatShowtimeStatus.RESERVED, SeatShowtimeStatus.BOOKED])(
    'conflicts for %s without partial updates',
    async (status) => {
      mockSeatShowtimeModel.find.mockReturnValue(
        query([
          {
            _id: SS1_ID,
            showtimeId: ST1_ID,
            seatStatus: SeatShowtimeStatus.EMPTY,
          },
          { _id: SS2_ID, showtimeId: ST1_ID, seatStatus: status },
        ]),
      );
      await expect(
        service.reserveSeats([SS1_ID.toString(), SS2_ID.toString()]),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockSeatShowtimeModel.updateOne).not.toHaveBeenCalled();
    },
  );

  it('rolls back earlier reservation when a competing update wins', async () => {
    mockSeatShowtimeModel.find.mockReturnValue(
      query([
        {
          _id: SS1_ID,
          showtimeId: ST1_ID,
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
        {
          _id: SS2_ID,
          showtimeId: ST1_ID,
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
      ]),
    );
    mockSeatShowtimeModel.updateOne
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      });
    await expect(
      service.reserveSeats([SS1_ID.toString(), SS2_ID.toString()]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mockSeatShowtimeModel.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [SS1_ID] },
        showtimeId: ST1_ID,
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
    );
  });

  it('releases RESERVED seats only', async () => {
    mockSeatShowtimeModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    await expect(
      service.releaseSeats([SS1_ID.toString(), SS2_ID.toString()]),
    ).resolves.toBe(1);
    expect(mockSeatShowtimeModel.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [SS1_ID, SS2_ID] },
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
    );
  });

  describe('confirmSeats', () => {
    it('returns 0 when given empty seat list', async () => {
      await expect(service.confirmSeats([])).resolves.toBe(0);
      expect(mockSeatShowtimeModel.updateMany).not.toHaveBeenCalled();
    });

    it('confirms seats by updating RESERVED to BOOKED', async () => {
      mockSeatShowtimeModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      });
      await expect(
        service.confirmSeats([SS1_ID.toString(), SS2_ID.toString()]),
      ).resolves.toBe(2);
      expect(mockSeatShowtimeModel.updateMany).toHaveBeenCalledWith(
        {
          _id: { $in: [SS1_ID, SS2_ID] },
          seatStatus: SeatShowtimeStatus.RESERVED,
        },
        { $set: { seatStatus: SeatShowtimeStatus.BOOKED } },
      );
    });

    it('throws ConflictException when modifiedCount does not match', async () => {
      mockSeatShowtimeModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      await expect(
        service.confirmSeats([SS1_ID.toString(), SS2_ID.toString()]),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('joins seat, showtime, room, and movie details', async () => {
    mockSeatShowtimeModel.find.mockReturnValue(
      query([
        {
          _id: SS1_ID,
          showtimeId: ST1_ID,
          seatId: S1_ID,
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
      ]),
    );
    mockShowtimeModel.find.mockReturnValue(
      query([
        {
          _id: ST1_ID,
          roomId: R1_ID,
          movieId: M1_ID,
          startTime: new Date('2026-01-01'),
          endTime: new Date('2026-01-01T02:00:00Z'),
          basePrice: 100,
        },
      ]),
    );
    mockSeatModel.find.mockReturnValue(
      query([
        {
          _id: S1_ID,
          rowPosition: 'A',
          columnPosition: 2,
          seatType: 'STANDARD',
        },
      ]),
    );
    mockRoomModel.find.mockReturnValue(
      query([{ _id: R1_ID, roomName: 'Room 1' }]),
    );
    mockMovieModel.find.mockReturnValue(
      query([{ _id: M1_ID, movieName: 'Film' }]),
    );
    await expect(
      service.getSeatBookingDetails([SS1_ID.toString()]),
    ).resolves.toEqual([
      {
        seatShowtimeId: SS1_ID.toString(),
        showtimeId: ST1_ID.toString(),
        seatId: S1_ID.toString(),
        rowPosition: 'A',
        columnPosition: 2,
        seatType: 'STANDARD',
        seatStatus: SeatShowtimeStatus.EMPTY,
        basePrice: 100,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-01T02:00:00Z'),
        roomId: R1_ID.toString(),
        roomName: 'Room 1',
        movieId: M1_ID.toString(),
        movieName: 'Film',
      },
    ]);
  });
});
