import { ConflictException } from '@nestjs/common';
import { Model } from 'mongoose';
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
          seatShowtimeId: 'ss1',
          showtimeId: 'st1',
          seatId: 's1',
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
      ]),
    );
    jest.spyOn(service, 'getSeatBookingDetails').mockResolvedValue([]);
    await expect(service.reserveSeats(['ss1'])).resolves.toEqual([]);
    expect(mockSeatShowtimeModel.updateOne).toHaveBeenCalledWith(
      {
        seatShowtimeId: 'ss1',
        showtimeId: 'st1',
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
            seatShowtimeId: 'ss1',
            showtimeId: 'st1',
            seatStatus: SeatShowtimeStatus.EMPTY,
          },
          { seatShowtimeId: 'ss2', showtimeId: 'st1', seatStatus: status },
        ]),
      );
      await expect(service.reserveSeats(['ss1', 'ss2'])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockSeatShowtimeModel.updateOne).not.toHaveBeenCalled();
    },
  );

  it('rolls back earlier reservation when a competing update wins', async () => {
    mockSeatShowtimeModel.find.mockReturnValue(
      query([
        {
          seatShowtimeId: 'ss1',
          showtimeId: 'st1',
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
        {
          seatShowtimeId: 'ss2',
          showtimeId: 'st1',
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
    await expect(service.reserveSeats(['ss1', 'ss2'])).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockSeatShowtimeModel.updateMany).toHaveBeenCalledWith(
      {
        seatShowtimeId: { $in: ['ss1'] },
        showtimeId: 'st1',
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
    );
  });

  it('releases RESERVED seats only', async () => {
    mockSeatShowtimeModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    await expect(service.releaseSeats(['reserved', 'booked'])).resolves.toBe(1);
    expect(mockSeatShowtimeModel.updateMany).toHaveBeenCalledWith(
      {
        seatShowtimeId: { $in: ['reserved', 'booked'] },
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      { $set: { seatStatus: SeatShowtimeStatus.EMPTY } },
    );
  });

  it('joins seat, showtime, room, and movie details', async () => {
    mockSeatShowtimeModel.find.mockReturnValue(
      query([
        {
          seatShowtimeId: 'ss1',
          showtimeId: 'st1',
          seatId: 's1',
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
      ]),
    );
    mockShowtimeModel.find.mockReturnValue(
      query([
        {
          showtimeId: 'st1',
          roomId: 'r1',
          movieId: 'm1',
          startTime: new Date('2026-01-01'),
          endTime: new Date('2026-01-01T02:00:00Z'),
          basePrice: 100,
        },
      ]),
    );
    mockSeatModel.find.mockReturnValue(
      query([
        {
          seatId: 's1',
          rowPosition: 'A',
          columnPosition: 2,
          seatType: 'STANDARD',
        },
      ]),
    );
    mockRoomModel.find.mockReturnValue(
      query([{ roomId: 'r1', roomName: 'Room 1' }]),
    );
    mockMovieModel.find.mockReturnValue(
      query([{ movieId: 'm1', movieName: 'Film' }]),
    );
    await expect(service.getSeatBookingDetails(['ss1'])).resolves.toEqual([
      {
        seatShowtimeId: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        rowPosition: 'A',
        columnPosition: 2,
        seatType: 'STANDARD',
        seatStatus: SeatShowtimeStatus.EMPTY,
        basePrice: 100,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-01T02:00:00Z'),
        roomId: 'r1',
        roomName: 'Room 1',
        movieId: 'm1',
        movieName: 'Film',
      },
    ]);
  });
});
