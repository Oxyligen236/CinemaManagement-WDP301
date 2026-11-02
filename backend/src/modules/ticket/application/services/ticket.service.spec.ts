import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketStatus } from '@prisma/client';
import { ShowtimeContract } from '../../../showtime/contracts/showtime.contract';
import { InternalEventBus } from '../../../infra/event/application/internal-event-bus.interface';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('TicketService', () => {
  let service: TicketService;
  let mockPrisma: any;
  let mockShowtimeContract: jest.Mocked<ShowtimeContract>;
  let mockEventBus: {
    publish: jest.MockedFunction<InternalEventBus['publish']>;
  };

  beforeEach(() => {
    mockPrisma = {
      ticket: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
    };

    mockShowtimeContract = {
      getSeatShowtimeDetail: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new TicketService(mockPrisma, mockShowtimeContract, mockEventBus);
  });

  describe('scanTicket', () => {
    const staffContext = {
      staffId: 'staff-1',
      branchId: 'b-1',
      role: Role.STAFF,
    };

    it('ném lỗi NotFoundException khi không tìm thấy vé', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.scanTicket({ ticketCode: 'INVALID-CODE' }, staffContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném lỗi BadRequestException khi vé đã USED', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'USED-CODE',
        ticketStatus: TicketStatus.USED,
        usedAt: new Date(),
      });

      await expect(
        service.scanTicket({ ticketCode: 'USED-CODE' }, staffContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi vé CANCELLED', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'CANCELLED-CODE',
        ticketStatus: TicketStatus.CANCELLED,
      });

      await expect(
        service.scanTicket({ ticketCode: 'CANCELLED-CODE' }, staffContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi ForbiddenException khi nhân viên chưa được gán chi nhánh', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
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
        startTime: new Date(),
        endTime: new Date(),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });

      await expect(
        service.scanTicket(
          { ticketCode: 'VALID-CODE' },
          { staffId: 'staff-1', role: Role.STAFF },
        ),
      ).rejects.toThrow('Nhân viên chưa được gán chi nhánh làm việc');
    });

    it('ném lỗi ForbiddenException khi vé thuộc chi nhánh khác chi nhánh nhân viên làm việc', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
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
        startTime: new Date(),
        endTime: new Date(),
        branchId: 'b-2',
        branchName: 'Chi nhánh Hà Đông',
      });

      await expect(
        service.scanTicket({ ticketCode: 'VALID-CODE' }, staffContext),
      ).rejects.toThrow(
        'Vé này thuộc chi nhánh "Chi nhánh Hà Đông". Không thể soát tại chi nhánh khác!',
      );
    });

    it('ném lỗi BadRequestException khi chưa đến giờ soát vé', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      });

      const futureStart = new Date(Date.now() + 60 * 60 * 1000); // 1h tới
      const futureEnd = new Date(futureStart.getTime() + 120 * 60 * 1000);

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
        startTime: futureStart,
        endTime: futureEnd,
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });

      await expect(
        service.scanTicket({ ticketCode: 'VALID-CODE' }, staffContext),
      ).rejects.toThrow(
        'Chưa đến giờ soát vé. Thời gian soát vé bắt đầu trước 30 phút giờ chiếu',
      );
    });

    it('ném lỗi BadRequestException khi vé không thuộc suất chiếu đang chọn', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      });

      const now = new Date();
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
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });

      await expect(
        service.scanTicket(
          { ticketCode: 'VALID-CODE', showtimeId: 'st-other' },
          staffContext,
        ),
      ).rejects.toThrow('Vé không thuộc suất chiếu đang chọn');
    });

    it('ném lỗi BadRequestException khi suất chiếu đã kết thúc', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      });

      const now = new Date();
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
        startTime: new Date(now.getTime() - 150 * 60 * 1000),
        endTime: new Date(now.getTime() - 10 * 60 * 1000),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });

      await expect(
        service.scanTicket({ ticketCode: 'VALID-CODE' }, staffContext),
      ).rejects.toThrow('Suất chiếu đã kết thúc, vé đã hết hạn sử dụng');
    });

    it('soát vé thành công cho nhân viên đúng chi nhánh và chuyển trạng thái sang USED', async () => {
      const now = new Date();
      const validTicket = {
        id: 't-1',
        ticketCode: 'VALID-CODE',
        orderId: 'ord-1',
        price: 90000,
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      };
      mockPrisma.ticket.findUnique.mockResolvedValue(validTicket);

      const showtimeDetail = {
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Mai',
        roomId: 'r-1',
        roomName: 'Hall 1',
        seatId: 's-1',
        rowPosition: 'A',
        columnPosition: 1,
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
        branchAddress: '123 Đường 1',
      };
      mockShowtimeContract.getSeatShowtimeDetail.mockResolvedValue(
        showtimeDetail,
      );

      mockPrisma.ticket.update.mockResolvedValue({
        ...validTicket,
        ticketStatus: TicketStatus.USED,
        usedAt: new Date(),
        scannedBy: 'staff-1',
      });

      const result = await service.scanTicket(
        { ticketCode: 'VALID-CODE' },
        staffContext,
      );

      expect(mockPrisma.ticket.update).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(result.ticketCode).toBe('VALID-CODE');
      expect(result.ticketStatus).toBe(TicketStatus.USED);
    });

    it('soát vé thành công cho ADMIN ở bất kỳ chi nhánh nào', async () => {
      const now = new Date();
      const validTicket = {
        id: 't-1',
        ticketCode: 'VALID-CODE',
        orderId: 'ord-1',
        price: 90000,
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      };
      mockPrisma.ticket.findUnique.mockResolvedValue(validTicket);

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
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
        branchId: 'b-other',
        branchName: 'Chi nhánh Khác',
        branchAddress: '789 Đường 3',
      });

      mockPrisma.ticket.update.mockResolvedValue({
        ...validTicket,
        ticketStatus: TicketStatus.USED,
        usedAt: new Date(),
        scannedBy: 'admin-1',
      });

      const adminContext = { staffId: 'admin-1', role: Role.ADMIN };
      const result = await service.scanTicket(
        { ticketCode: 'VALID-CODE' },
        adminContext,
      );

      expect(result.ticketStatus).toBe(TicketStatus.USED);
    });
  });

  describe('getTicketDetail', () => {
    it('trả về chi tiết vé thành công', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'TK-001',
        orderId: 'ord-1',
        price: 90000,
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
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
        startTime: new Date(),
        endTime: new Date(),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
        branchAddress: '123 Đường 1',
      });

      const result = await service.getTicketDetail('TK-001');

      expect(result.ticketCode).toBe('TK-001');
      expect(result.seatLabel).toBe('A1');
      expect(result.movieTitle).toBe('Mai');
    });
  });

  describe('getTicketsByOrderId', () => {
    it('trả về danh sách vé cho đơn hàng qua TicketContract', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          id: 't-1',
          ticketCode: 'TK-001',
          orderId: 'ord-1',
          price: 90000,
          ticketStatus: TicketStatus.VALID,
          seatShowtimeId: 'sst-1',
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
        startTime: new Date(),
        endTime: new Date(),
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });

      const result = await service.getTicketsByOrderId('ord-1');

      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TK-001');
      expect(result[0].seatLabel).toBe('A1');
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
      expect(mockPrisma.ticket.createMany).not.toHaveBeenCalled();
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
        branchId: 'b-1',
        branchName: 'Chi nhánh 1',
      });
      mockPrisma.ticket.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createTicketsForOrder({
        orderId: 'ord-1',
        seatShowtimeIds: ['sst-1'],
      });

      expect(mockPrisma.ticket.createMany).toHaveBeenCalledTimes(1);
      const insertCalls = mockPrisma.ticket.createMany.mock.calls[0][0];
      const inserted = insertCalls.data;
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
