/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { TicketService } from './ticket.service';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ShowtimeBookingService } from '../../../showtime/application/services/showtime-booking.service';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';

describe('TicketService', () => {
  type MockPrisma = {
    ticket: {
      createMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  let service: TicketService;
  let mockPrisma: MockPrisma;

  const mockShowtimeBookingService = {
    getSeatShowtimeDetail: jest.fn(),
  };

  const mockEventBus: InternalEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEventBus.publish = jest.fn().mockResolvedValue(undefined);

    mockPrisma = {
      ticket: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ShowtimeBookingService,
          useValue: mockShowtimeBookingService,
        },
        {
          provide: INTERNAL_EVENT_BUS,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
  });

  describe('scanTicket', () => {
    const scanStaffContext = {
      staffId: 'staff-1',
      branchId: 'b-1',
      role: Role.STAFF,
    };

    it('ném lỗi BadRequestException khi mã vé để trống', async () => {
      await expect(
        service.scanTicket(scanStaffContext, { ticketCode: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi NotFoundException khi không tìm thấy vé', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.scanTicket(scanStaffContext, { ticketCode: 'INVALID-CODE' }),
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
        service.scanTicket(scanStaffContext, { ticketCode: 'USED-CODE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi vé CANCELLED / không VALID', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'CANCELLED-CODE',
        ticketStatus: TicketStatus.CANCELLED,
      });

      await expect(
        service.scanTicket(scanStaffContext, { ticketCode: 'CANCELLED-CODE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi ForbiddenException khi nhân viên chưa được gán chi nhánh', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'VALID-CODE',
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      });

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
          { staffId: 'staff-1', role: Role.STAFF },
          { ticketCode: 'VALID-CODE' },
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

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
        service.scanTicket(scanStaffContext, { ticketCode: 'VALID-CODE' }),
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

      const futureStart = new Date(Date.now() + 60 * 60 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 120 * 60 * 1000);

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
        service.scanTicket(scanStaffContext, { ticketCode: 'VALID-CODE' }),
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
      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
        service.scanTicket(scanStaffContext, {
          ticketCode: 'VALID-CODE',
          showtimeId: 'st-other',
        }),
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
      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
        service.scanTicket(scanStaffContext, { ticketCode: 'VALID-CODE' }),
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
      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue(
        showtimeDetail,
      );

      mockPrisma.ticket.update.mockResolvedValue({
        ...validTicket,
        ticketStatus: TicketStatus.USED,
        usedAt: new Date(),
        scannedBy: 'staff-1',
      });

      const result = await service.scanTicket(scanStaffContext, {
        ticketCode: 'VALID-CODE',
      });

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

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
      const result = await service.scanTicket(adminContext, {
        ticketCode: 'VALID-CODE',
      });

      expect(result.ticketStatus).toBe(TicketStatus.USED);
    });
  });

  describe('getTicketDetail', () => {
    it('ném lỗi NotFoundException khi không tìm thấy vé', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.getTicketDetail('UNKNOWN-CODE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về chi tiết vé thành công', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 't-1',
        ticketCode: 'TK-001',
        orderId: 'ord-1',
        price: 90000,
        ticketStatus: TicketStatus.VALID,
        seatShowtimeId: 'sst-1',
      });

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
      expect(result.branchName).toBe('Chi nhánh 1');
    });
  });

  describe('getTicketsByOrderId', () => {
    it('trả về mảng rỗng khi không có vé', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.getTicketsByOrderId('ord-empty');

      expect(result).toEqual([]);
    });

    it('trả về danh sách vé cho đơn hàng', async () => {
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

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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

      const result = await service.createTicketsForOrder('ord-1', [
        { seatShowtimeId: 'sst-1', price: 90000 },
      ]);

      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TK-EXISTING');
      expect(mockPrisma.ticket.createMany).not.toHaveBeenCalled();
    });

    it('ném BadRequestException khi mã đơn hàng rỗng', async () => {
      await expect(
        service.createTicketsForOrder('', [
          { seatShowtimeId: 'sst-1', price: 90000 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném BadRequestException khi danh sách ghế rỗng', async () => {
      jest.spyOn(service, 'getTicketsByOrderId').mockResolvedValue([]);

      await expect(service.createTicketsForOrder('ord-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ném BadRequestException khi không tìm thấy thông tin suất chiếu cho ghế', async () => {
      jest.spyOn(service, 'getTicketsByOrderId').mockResolvedValue([]);
      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue(null);

      await expect(
        service.createTicketsForOrder('ord-1', [
          { seatShowtimeId: 'sst-not-found', price: 90000 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('tạo vé mới cho từng ghế và trả về danh sách chi tiết vé', async () => {
      jest
        .spyOn(service, 'getTicketsByOrderId')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ticketId: 't-new-1',
            ticketCode: 'TK-20261104-ABCDEF',
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

      mockShowtimeBookingService.getSeatShowtimeDetail.mockResolvedValue({
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
        price: 90000,
      });

      const result = await service.createTicketsForOrder('ord-1', [
        { seatShowtimeId: 'sst-1', price: 90000 },
      ]);

      expect(mockPrisma.ticket.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            orderId: 'ord-1',
            seatShowtimeId: 'sst-1',
            price: 90000,
            ticketStatus: TicketStatus.VALID,
            ticketCode: expect.stringMatching(/^TK-\d{8}-[A-F0-9]{6}$/),
          }),
        ]),
      });
      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TK-20261104-ABCDEF');
    });
  });
});
