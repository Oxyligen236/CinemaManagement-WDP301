import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { TicketService } from './ticket.service';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { TicketDocument } from '../../domain/schemas/ticket.schema';
import { ShowtimeContract } from '../../../showtime/contracts/showtime.contract';
import { InternalEventBus } from '../../../infra/event/application/internal-event-bus.interface';

describe('TicketService', () => {
  let service: TicketService;
  let mockTicketModel: {
    findOne: jest.Mock;
    find: jest.Mock;
    insertMany: jest.Mock;
  };
  let mockShowtimeContract: jest.Mocked<ShowtimeContract>;
  let mockEventBus: {
    publish: jest.MockedFunction<InternalEventBus['publish']>;
  };

  beforeEach(() => {
    mockTicketModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      insertMany: jest.fn(),
    };

    mockShowtimeContract = {
      getSeatShowtimeDetail: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new TicketService(
      mockTicketModel as unknown as Model<TicketDocument>,
      mockShowtimeContract,
      mockEventBus,
    );
  });

  describe('scanTicket', () => {
    it('ném lỗi NotFoundException khi không tìm thấy vé', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.scanTicket({ ticketCode: 'INVALID-CODE' }, 'staff-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném lỗi BadRequestException khi vé đã USED', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'USED-CODE',
          ticketStatus: TicketStatus.USED,
          usedAt: new Date(),
        }),
      });

      await expect(
        service.scanTicket({ ticketCode: 'USED-CODE' }, 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi vé CANCELLED', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'CANCELLED-CODE',
          ticketStatus: TicketStatus.CANCELLED,
        }),
      });

      await expect(
        service.scanTicket({ ticketCode: 'CANCELLED-CODE' }, 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi chưa đến giờ soát vé', async () => {
      const futureStartTime = new Date(Date.now() + 60 * 60 * 1000); // 60 phút nữa mới chiếu
      const futureEndTime = new Date(Date.now() + 180 * 60 * 1000);

      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'VALID-CODE',
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
        }),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Hall 1',
        seatId: 's-1',
        rowPosition: 'A',
        columnPosition: 1,
        startTime: futureStartTime,
        endTime: futureEndTime,
      });

      await expect(
        service.scanTicket(
          { ticketCode: 'VALID-CODE', showtimeId: 'st-1' },
          'staff-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi vé không thuộc suất chiếu đang chọn', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'VALID-CODE',
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
        }),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-2',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Hall 1',
        seatId: 's-1',
        rowPosition: 'A',
        columnPosition: 1,
        startTime: new Date(Date.now() + 10 * 60 * 1000),
        endTime: new Date(Date.now() + 120 * 60 * 1000),
      });

      await expect(
        service.scanTicket(
          { ticketCode: 'VALID-CODE', showtimeId: 'st-1' },
          'staff-1',
        ),
      ).rejects.toThrow('Vé không thuộc suất chiếu đang chọn');
    });

    it('ném lỗi BadRequestException khi suất chiếu đã kết thúc', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'VALID-CODE',
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
        }),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Hall 1',
        seatId: 's-1',
        rowPosition: 'A',
        columnPosition: 1,
        startTime: new Date(Date.now() - 150 * 60 * 1000),
        endTime: new Date(Date.now() - 30 * 60 * 1000),
      });

      await expect(
        service.scanTicket(
          { ticketCode: 'VALID-CODE', showtimeId: 'st-1' },
          'staff-1',
        ),
      ).rejects.toThrow('Suất chiếu đã kết thúc, vé đã hết hạn sử dụng');
    });

    it('soát vé thành công và chuyển trạng thái sang USED', async () => {
      const now = Date.now();
      const startTime = new Date(now + 10 * 60 * 1000); // 10 phút nữa chiếu (nằm trong 30p trước)
      const endTime = new Date(now + 120 * 60 * 1000);

      const saveMock = jest.fn().mockResolvedValue(true);
      const ticketDoc = {
        ticketId: 't-1',
        ticketCode: 'VALID-CODE',
        orderId: 'ord-1',
        price: 95000,
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
        usedAt: undefined,
        scannedBy: undefined,
        save: saveMock,
      };

      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(ticketDoc),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Cinema 01',
        seatId: 'seat-101',
        rowPosition: 'F',
        columnPosition: 8,
        startTime,
        endTime,
      });

      const result = await service.scanTicket(
        { ticketCode: 'VALID-CODE' },
        'staff-100',
      );

      expect(ticketDoc.ticketStatus).toBe(TicketStatus.USED);
      expect(ticketDoc.scannedBy).toBe('staff-100');
      expect(saveMock).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(result.ticketCode).toBe('VALID-CODE');
      expect(result.movieTitle).toBe('Mai');
      expect(result.seatLabel).toBe('F8');
      expect(result.scannedBy).toBe('staff-100');
    });
  });

  describe('getTicketDetail', () => {
    it('trả về chi tiết vé thành công', async () => {
      mockTicketModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ticketId: 't-1',
          ticketCode: 'TK-123',
          orderId: 'ord-1',
          price: 90000,
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
          usedAt: undefined,
        }),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Dune 2',
        roomId: 'r-1',
        roomName: 'Hall IMAX',
        seatId: 's-1',
        rowPosition: 'G',
        columnPosition: 12,
        startTime: new Date(),
        endTime: new Date(),
      });

      const res = await service.getTicketDetail('TK-123');

      expect(res.ticketCode).toBe('TK-123');
      expect(res.movieTitle).toBe('Dune 2');
      expect(res.seatLabel).toBe('G12');
    });
  });

  describe('getTicketsByOrderId', () => {
    it('trả về danh sách vé cho đơn hàng qua TicketContract', async () => {
      mockTicketModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            ticketId: 't-1',
            ticketCode: 'TK-1',
            price: 80000,
            ticketStatus: TicketStatus.VALID,
            seatShowtimeId: 'sst-1',
          },
        ]),
      });

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Avatar 2',
        roomId: 'r-1',
        roomName: 'Hall 2',
        seatId: 's-1',
        rowPosition: 'B',
        columnPosition: 4,
        startTime: new Date(),
        endTime: new Date(),
      });

      const tickets = await service.getTicketsByOrderId('ord-1');
      expect(tickets.length).toBe(1);
      expect(tickets[0].ticketCode).toBe('TK-1');
      expect(tickets[0].seatLabel).toBe('B4');
    });
  });

  describe('createTicketsForOrder', () => {
    it('trả về vé hiện tại nếu đơn hàng đã được tạo vé trước đó (idempotent)', async () => {
      jest.spyOn(service, 'getTicketsByOrderId').mockResolvedValue([
        {
          ticketId: 't-1',
          ticketCode: 'TK-EXISTING',
          price: 90000,
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
          movieTitle: 'Mai',
          roomName: 'Hall 1',
          seatLabel: 'A1',
          startTime: new Date(),
          endTime: new Date(),
        },
      ]);

      const result = await service.createTicketsForOrder({
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      });

      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TK-EXISTING');
      expect(mockTicketModel.insertMany).not.toHaveBeenCalled();
    });

    it('ném BadRequestException khi danh sách ghế rỗng', async () => {
      jest.spyOn(service, 'getTicketsByOrderId').mockResolvedValue([]);

      await expect(
        service.createTicketsForOrder({
          orderId: 'ord-1',
          seatShowtimeIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném BadRequestException khi không tìm thấy thông tin suất chiếu cho ghế', async () => {
      jest.spyOn(service, 'getTicketsByOrderId').mockResolvedValue([]);
      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue(null);

      await expect(
        service.createTicketsForOrder({
          orderId: 'ord-1',
          seatShowtimeIds: ['sst-not-found'],
        }),
      ).rejects.toThrow(
        'Không tìm thấy thông tin suất chiếu cho ghế sst-not-found',
      );
    });

    it('tạo vé mới cho từng ghế và trả về danh sách chi tiết vé', async () => {
      jest
        .spyOn(service, 'getTicketsByOrderId')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ticketId: 't-new-1',
            ticketCode: 'TK-20261025-ABCDEF',
            price: 85000,
            ticketStatus: TicketStatus.VALID,
            seatShowtimeId: 'sst-1',
            movieTitle: 'Mai',
            roomName: 'Hall 1',
            seatLabel: 'A1',
            startTime: new Date(),
            endTime: new Date(),
          },
        ]);

      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Hall 1',
        seatId: 's-1',
        rowPosition: 'A',
        columnPosition: 1,
        price: 85000,
        startTime: new Date(),
        endTime: new Date(),
      });
      mockTicketModel.insertMany.mockResolvedValue([]);

      const result = await service.createTicketsForOrder({
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      });

      expect(mockTicketModel.insertMany).toHaveBeenCalledTimes(1);
      const insertCalls = mockTicketModel.insertMany.mock.calls as unknown as [
        Array<Record<string, unknown>>,
      ][];
      const inserted = insertCalls[0][0];
      expect(inserted.length).toBe(1);
      expect(inserted[0].orderId).toBe('ord-1');
      expect(inserted[0].seatShowtimeId).toBe('sst-1');
      expect(inserted[0].price).toBe(85000);
      expect(inserted[0].ticketStatus).toBe(TicketStatus.VALID);
      expect(inserted[0].ticketCode).toMatch(/^TK-\d{8}-[A-F0-9]{6}$/);
      expect(result.length).toBe(1);
    });
  });
});
