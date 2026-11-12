/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { OrderService } from './order.service';
import { PosOrderService } from './pos-order.service';
import { TicketService } from './ticket.service';
import { ORDER_BOOKING_MESSAGES } from '../../domain/constants/order.constant';
import { PaymentService } from '../../../payment/application/services/payment.service';
import { ShowtimeBookingService } from '../../../showtime/application/services/showtime-booking.service';
import { ProductService } from '../../../product/application/services/product.service';
import { PromotionPublicService } from '../../../promotion/application/services/promotion-public.service';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('PosOrderService', () => {
  type MockPrisma = {
    order: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    seatOrder: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    productOrder: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let service: PosOrderService;
  let ticketService: TicketService;
  let mockPrisma: MockPrisma;

  const staffContext = {
    staffId: 'staff-001',
    branchId: 'branch-hn-01',
    staffName: 'Nguyen Van A',
  };

  const mockPosOrder = {
    id: 'order-pos-123',
    userId: 'staff-001',
    branchId: 'branch-hn-01',
    totalAmount: 180000,
    status: OrderStatus.PENDING,
  };

  const mockPaymentService = {
    checkPaymentStatus: jest.fn(),
  };

  const mockProductService = {
    getProductsByIds: jest.fn(),
    deductConcessionStock: jest.fn(),
  };

  const mockPromotionPublicService = {
    validatePromotionCode: jest.fn(),
    getPromotionById: jest.fn(),
  };

  const mockShowtimeBookingService = {
    reserveSeats: jest.fn(),
    releaseSeats: jest.fn(),
    confirmSeats: jest.fn(),
    getSeatBookingDetails: jest.fn().mockResolvedValue([]),
    getSeatShowtimeDetail: jest.fn().mockResolvedValue({
      seatShowtimeId: 'sst-1',
      showtimeId: 'show-1',
      movieId: 'movie-1',
      movieTitle: 'Mai',
      roomId: 'room-1',
      roomName: 'Cinema 01',
      seatId: 'seat-1',
      rowPosition: 'F',
      columnPosition: 8,
      startTime: new Date('2026-03-30T14:00:00Z'),
      endTime: new Date('2026-03-30T16:00:00Z'),
      branchId: 'branch-hn-01',
      branchName: 'Chi nhánh Hà Nội',
    }),
  };

  const mockQueueService: QueueService = {
    publish: jest.fn(),
    consume: jest.fn(),
  };

  const mockEventBus: InternalEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEventBus.publish = jest.fn().mockResolvedValue(undefined);

    mockPrisma = {
      order: {
        create: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) =>
            Promise.resolve({
              id: 'order-123',
              ...args.data,
            }),
          ),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      seatOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      productOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: MockPrisma) => unknown) =>
        cb(mockPrisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosOrderService,
        OrderService,
        TicketService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: ShowtimeBookingService,
          useValue: mockShowtimeBookingService,
        },
        {
          provide: ProductService,
          useValue: mockProductService,
        },
        {
          provide: PromotionPublicService,
          useValue: mockPromotionPublicService,
        },
        {
          provide: QUEUE_SERVICE,
          useValue: mockQueueService,
        },
        {
          provide: INTERNAL_EVENT_BUS,
          useValue: mockEventBus,
        },
        {
          provide: BranchQueryService,
          useValue: {
            getBranchSummary: jest.fn().mockResolvedValue({
              branchId: 'branch-01',
              branchName: 'MyCast Cinema Nam Sài Gòn',
            }),
            getPublicBranches: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PosOrderService>(PosOrderService);
    ticketService = module.get<TicketService>(TicketService);
  });

  describe('createPosBookingOrder', () => {
    it('should throw BadRequestException if seatShowtimeIds is empty and products is empty', async () => {
      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cho phep dat don chi co F&B (khong co ghe)', async () => {
      const prodMap = new Map();
      prodMap.set('prod-1', {
        productId: 'prod-1',
        productName: 'Combo Solo',
        unitPrice: 60000,
        branchId: 'branch-hn-01',
      });
      mockProductService.getProductsByIds.mockResolvedValue(prodMap);

      const result = await service.createPosBookingOrder(staffContext, {
        products: [{ productId: 'prod-1', quantity: 2 }],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.totalAmount).toBe(120000);
      expect(result.seats).toHaveLength(0);
      expect(mockShowtimeBookingService.reserveSeats).not.toHaveBeenCalled();
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: staffContext.staffId,
          branchId: staffContext.branchId,
          totalAmount: 120000,
          status: OrderStatus.PENDING,
        }),
      });
    });

    it('should throw ForbiddenException if reserved seats belong to different branch', async () => {
      mockShowtimeBookingService.reserveSeats.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          basePrice: 90000,
          branchId: 'branch-other',
        },
      ]);
      mockShowtimeBookingService.releaseSeats.mockResolvedValue(1);

      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: ['sst-1'],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockShowtimeBookingService.releaseSeats).toHaveBeenCalledWith([
        'sst-1',
      ]);
    });

    it('should throw ForbiddenException if products belong to different branch', async () => {
      mockShowtimeBookingService.reserveSeats.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          basePrice: 90000,
          branchId: 'branch-hn-01',
        },
      ]);
      const prodMap = new Map();
      prodMap.set('prod-1', {
        productId: 'prod-1',
        productName: 'Bắp rang',
        unitPrice: 50000,
        branchId: 'branch-other',
      });
      mockProductService.getProductsByIds.mockResolvedValue(prodMap);
      mockShowtimeBookingService.releaseSeats.mockResolvedValue(1);

      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: ['sst-1'],
          products: [{ productId: 'prod-1', quantity: 1 }],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockShowtimeBookingService.releaseSeats).toHaveBeenCalledWith([
        'sst-1',
      ]);
    });

    it('should create POS booking order without saving old 9 fields', async () => {
      mockShowtimeBookingService.reserveSeats.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: 'STANDARD',
          basePrice: 90000,
          startTime: new Date(Date.now() + 86_400_000),
          branchId: 'branch-hn-01',
        },
      ]);
      const prodMap = new Map();
      prodMap.set('prod-1', {
        productId: 'prod-1',
        productName: 'Combo Solo',
        unitPrice: 60000,
        branchId: 'branch-hn-01',
      });
      mockProductService.getProductsByIds.mockResolvedValue(prodMap);

      const result = await service.createPosBookingOrder(staffContext, {
        showtimeId: 'st-01',
        seatShowtimeIds: ['sst-1'],
        products: [{ productId: 'prod-1', quantity: 1 }],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.totalAmount).toBe(150000);
      expect(result.userId).toBe('staff-001');
      expect(
        (result as unknown as Record<string, unknown>).customerPhone,
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).customerName,
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).discountAmount,
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).finalAmount,
      ).toBeUndefined();
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: staffContext.staffId,
          branchId: staffContext.branchId,
          totalAmount: 150000,
          status: OrderStatus.PENDING,
        }),
      });
      expect(mockQueueService.publish).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should release seats and throw BadRequestException if reserved seats belong to a past showtime', async () => {
      mockShowtimeBookingService.reserveSeats.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          basePrice: 90000,
          startTime: new Date(Date.now() - 60_000),
          branchId: 'branch-hn-01',
        },
      ]);
      mockShowtimeBookingService.releaseSeats.mockResolvedValue(1);

      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: ['sst-1'],
        }),
      ).rejects.toThrow(
        new BadRequestException(ORDER_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING),
      );

      expect(mockShowtimeBookingService.releaseSeats).toHaveBeenCalledWith([
        'sst-1',
      ]);
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockQueueService.publish).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('cancelPosOrder & verifyOrderBranch', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelPosOrder(staffContext, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order belongs to different branch via seats', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockPosOrder,
        branchId: undefined,
        status: OrderStatus.PENDING,
      });
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { seatShowtimeId: 'sst-1' },
      ]);
      mockShowtimeBookingService.getSeatBookingDetails.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-other',
        },
      ]);

      await expect(
        service.cancelPosOrder(staffContext, 'order-pos-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should cancel pending order and release seats when branch matches', async () => {
      const orderToCancel = {
        ...mockPosOrder,
        status: OrderStatus.PENDING,
      };
      mockPrisma.order.findUnique.mockResolvedValue(orderToCancel);
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { seatShowtimeId: 'sst-1' },
      ]);
      mockShowtimeBookingService.getSeatBookingDetails.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      mockShowtimeBookingService.releaseSeats.mockResolvedValue(1);

      const res = await service.cancelPosOrder(staffContext, 'order-pos-123');

      expect(res.success).toBe(true);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-pos-123' },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockShowtimeBookingService.releaseSeats).toHaveBeenCalledWith([
        'sst-1',
      ]);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('getPosReceipt', () => {
    it('should return receipt data with actual paymentMethod from PaymentService and totalAmount', async () => {
      const paidOrder = {
        ...mockPosOrder,
        status: OrderStatus.PAID,
        totalAmount: 180000,
      };
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { seatShowtimeId: 'sst-1' },
      ]);
      mockShowtimeBookingService.getSeatBookingDetails.mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      mockPaymentService.checkPaymentStatus.mockResolvedValue({
        paymentId: 'pay-001',
        amount: 180000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
      });
      jest.spyOn(ticketService, 'getTicketsByOrderId').mockResolvedValue([
        {
          ticketId: 't-123',
          ticketCode: 'TK-123',
          ticketStatus: 'VALID',
          seatShowtimeId: 'sst-1',
          movieTitle: 'Kung Fu Panda 4',
          roomName: 'P01',
          seatLabel: 'A1',
          startTime: new Date(),
          endTime: new Date(),
          price: 90000,
        },
      ]);
      mockPrisma.productOrder.findMany.mockResolvedValue([
        { productId: 'prod-1', quantity: 2, unitPrice: 45000 },
      ]);
      const prodMap = new Map();
      prodMap.set('prod-1', { productName: 'Bắp bơ', unitPrice: 45000 });
      mockProductService.getProductsByIds.mockResolvedValue(prodMap);

      const receipt = await service.getPosReceipt(
        staffContext,
        'order-pos-123',
      );

      expect(receipt.orderId).toBe('order-pos-123');
      expect(receipt.paymentMethod).toBe(PaymentMethod.CASH);
      expect(receipt.totalAmount).toBe(180000);
      expect(receipt.tickets).toHaveLength(1);
      expect(receipt.products).toHaveLength(1);
      expect(
        (receipt as unknown as Record<string, unknown>).customerName,
      ).toBeUndefined();
      expect(
        (receipt as unknown as Record<string, unknown>).customerPhone,
      ).toBeUndefined();
      expect(
        (receipt as unknown as Record<string, unknown>).discountAmount,
      ).toBeUndefined();
      expect(
        (receipt as unknown as Record<string, unknown>).finalAmount,
      ).toBeUndefined();
    });

    it('should throw BadRequestException if order is not PAID', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockPosOrder,
        status: OrderStatus.PENDING,
      });
      mockPrisma.seatOrder.findMany.mockResolvedValue([]);

      await expect(
        service.getPosReceipt(staffContext, 'order-pos-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
