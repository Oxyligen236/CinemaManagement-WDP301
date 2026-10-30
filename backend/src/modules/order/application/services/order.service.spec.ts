/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderStatus } from '@prisma/client';
import {
  ORDER_EXPIRATION_QUEUE,
  ORDER_HOLD_TIMEOUT_MS,
} from '../../domain/constants/order.constant';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';
import { OrderExpiredEvent } from '../../domain/events/order-expired.event';
import {
  TICKET_CONTRACT,
  TicketContract,
} from '../../contracts/ticket.contract';
import {
  PRODUCT_CONTRACT,
  ProductContract,
  ProductSummaryDto,
} from '../../contracts/product.contract';
import {
  PROMOTION_CONTRACT,
  PromotionContract,
} from '../../contracts/promotion.contract';
import {
  SHOWTIME_BOOKING,
  ShowtimeBookingContract,
} from '../../contracts/showtime-booking.contract';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryMyOrdersReq } from '../dto/req.dto';
import { PAYMENT_CONTRACT } from '../../contracts/payment.contract';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('OrderService', () => {
  let service: OrderService;
  let mockPrisma: any;

  const mockOrder = {
    id: 'order-123',
    userId: 'user-001',
    totalAmount: 180000,
    status: OrderStatus.PAID,
    promotionId: 'promo-001',
    createdAt: new Date('2026-03-30T10:00:00Z'),
  };

  const mockTicketContract: TicketContract = {
    createTicketsForOrder: jest.fn().mockResolvedValue([]),
    getTicketsByOrderId: jest.fn().mockResolvedValue([
      {
        ticketId: 't-001',
        ticketCode: 'TK-123',
        price: 95000,
        ticketStatus: 'VALID',
        usedAt: undefined,
        seatShowtimeId: 'sst-1',
        movieTitle: 'Mai',
        roomName: 'Cinema 01',
        seatLabel: 'F8',
        startTime: new Date('2026-03-30T14:00:00Z'),
        endTime: new Date('2026-03-30T16:00:00Z'),
      },
    ]),
  };

  const mockProductContract: ProductContract = {
    deductConcessionStock: jest.fn().mockResolvedValue(true),
    getProductsByIds: jest.fn().mockImplementation(() => {
      const map = new Map<string, ProductSummaryDto>();
      map.set('prod-001', {
        productId: 'prod-001',
        productName: 'Bắp rang bơ',
        imageUrl: 'http://img.com/popcorn.png',
        unitPrice: 65000,
      });
      return Promise.resolve(map);
    }),
  };

  const mockPromotionContract: PromotionContract = {
    getPromotionById: jest.fn().mockResolvedValue({
      promotionId: 'promo-001',
      promotionCode: 'SALE20',
      discountValue: 20,
      discountType: 'PERCENTAGE',
      isActive: true,
    }),
    validatePromotionCode: jest.fn().mockResolvedValue({
      isValid: true,
      promotionId: 'promo-001',
      promotionCode: 'SALE20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      discountAmount: 20000,
    }),
    recordPromotionUsage: jest.fn().mockResolvedValue(undefined),
  };

  const mockShowtimeBooking: ShowtimeBookingContract = {
    reserveSeats: jest.fn(),
    releaseSeats: jest.fn(),
    confirmSeats: jest.fn(),
    getSeatBookingDetails: jest.fn(),
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

    mockPrisma = {
      order: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            id: 'order-123',
            ...args.data,
          }),
        ),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      seatOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      productOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PAYMENT_CONTRACT,
          useValue: {
            createVnpayPayment: jest.fn(),
            verifyVnpayReturn: jest.fn(),
          },
        },
        {
          provide: TICKET_CONTRACT,
          useValue: mockTicketContract,
        },
        {
          provide: PRODUCT_CONTRACT,
          useValue: mockProductContract,
        },
        {
          provide: PROMOTION_CONTRACT,
          useValue: mockPromotionContract,
        },
        {
          provide: SHOWTIME_BOOKING,
          useValue: mockShowtimeBooking,
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

    service = module.get<OrderService>(OrderService);
  });

  describe('createBookingOrder', () => {
    it('tao don dat ve thanh cong: ghe reserve, order PENDING, delayed job published, event emitted', async () => {
      const seatDetails = [
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ];

      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue(
        seatDetails,
      );
      (mockQueueService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventBus.publish as jest.Mock).mockResolvedValue(undefined);

      const res = await service.createBookingOrder('user-001', {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
        products: [{ productId: 'prod-001', quantity: 1 }],
      });

      expect(mockShowtimeBooking.reserveSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-001',
            status: OrderStatus.PENDING,
            totalAmount: 160000,
          }),
        }),
      );
      expect(mockQueueService.publish).toHaveBeenCalledWith(
        ORDER_EXPIRATION_QUEUE,
        { orderId: res.orderId },
        { delayTime: ORDER_HOLD_TIMEOUT_MS },
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderCreatedEvent),
      );
      expect(res.status).toBe(OrderStatus.PENDING);
      expect(res.seats).toHaveLength(1);
      expect(res.products).toHaveLength(1);
    });

    it('that bai khi reserve conflict: khong tao order, throw ConflictException', async () => {
      (mockShowtimeBooking.reserveSeats as jest.Mock).mockRejectedValue(
        new ConflictException('Seat is no longer available'),
      );

      await expect(
        service.createBookingOrder('user-001', {
          showtimeId: 'show-1',
          seatShowtimeIds: ['sst-1'],
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockQueueService.publish).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('that bai khi queue publish loi: rollback order va release seats', async () => {
      const seatDetails = [
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ];

      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue(
        seatDetails,
      );
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);
      (mockQueueService.publish as jest.Mock).mockRejectedValue(
        new Error('Redis connection lost'),
      );

      await expect(
        service.createBookingOrder('user-001', {
          showtimeId: 'show-1',
          seatShowtimeIds: ['sst-1'],
        }),
      ).rejects.toThrow('Redis connection lost');

      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockPrisma.order.delete).toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('thanh cong ngay ca khi eventBus.publish throw error (khong lam fail booking order)', async () => {
      const seatDetails = [
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ];

      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue(
        seatDetails,
      );
      (mockQueueService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventBus.publish as jest.Mock).mockRejectedValue(
        new Error('Event bus listener failure'),
      );

      const res = await service.createBookingOrder('user-001', {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
      });

      expect(res.status).toBe(OrderStatus.PENDING);
      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderCreatedEvent),
      );
    });

    it('tao don dat ve thanh cong voi promotionCode hop le: ap dung giam gia va luu promotionId', async () => {
      const seatDetails = [
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ];

      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue(
        seatDetails,
      );
      (
        mockPromotionContract.validatePromotionCode as jest.Mock
      ).mockResolvedValue({
        isValid: true,
        promotionId: 'promo-001',
        promotionCode: 'SALE20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        discountAmount: 19000,
      });
      (mockQueueService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventBus.publish as jest.Mock).mockResolvedValue(undefined);

      const res = await service.createBookingOrder('user-001', {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
        promotionCode: 'SALE20',
      });

      expect(mockPromotionContract.validatePromotionCode).toHaveBeenCalledWith({
        code: 'SALE20',
        orderAmount: 95000,
        userId: 'user-001',
      });
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-001',
            promotionId: 'promo-001',
            totalAmount: 76000,
            status: OrderStatus.PENDING,
          }),
        }),
      );
      expect(res.promotion).toBeDefined();
      expect(res.promotion?.promotionId).toBe('promo-001');
      expect(res.promotion?.discountAmount).toBe(19000);
      expect(res.totalAmount).toBe(76000);
    });

    it('that bai khi promotionCode khong hop le hoac nguoi dung da su dung: releaseSeats va throw BadRequestException', async () => {
      const seatDetails = [
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ];

      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue(
        seatDetails,
      );
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);
      (
        mockPromotionContract.validatePromotionCode as jest.Mock
      ).mockResolvedValue({
        isValid: false,
        discountAmount: 0,
        reason: 'Bạn đã sử dụng mã giảm giá này rồi',
      });

      await expect(
        service.createBookingOrder('user-001', {
          showtimeId: 'show-1',
          seatShowtimeIds: ['sst-1'],
          promotionCode: 'ALREADY_USED',
        }),
      ).rejects.toThrow(
        new BadRequestException('Bạn đã sử dụng mã giảm giá này rồi'),
      );

      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockQueueService.publish).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('getBookingSummary', () => {
    it('lay booking summary thanh cong cho chu so huu', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'user-001',
        status: OrderStatus.PENDING,
        totalAmount: 95000,
        createdAt: new Date(),
      });

      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { orderId: 'order-123', seatShowtimeId: 'sst-1', price: 95000 },
      ]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);

      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date(),
          endTime: new Date(),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ]);

      const res = await service.getBookingSummary('user-001', 'order-123');

      expect(res.orderId).toBe('order-123');
      expect(res.status).toBe(OrderStatus.PENDING);
      expect(res.seats).toHaveLength(1);
    });

    it('nem ForbiddenException khi sai chu so huu', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'another-user',
        status: OrderStatus.PENDING,
        totalAmount: 95000,
        createdAt: new Date(),
      });

      await expect(
        service.getBookingSummary('user-001', 'order-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nem NotFoundException khi don hang khong ton tai', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getBookingSummary('user-001', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('expireOrder', () => {
    it('expire order thanh cong: PENDING -> EXPIRED, nha ghe RESERVED -> EMPTY, event emitted', async () => {
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { orderId: 'order-123', seatShowtimeId: 'sst-1' },
      ]);

      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);
      (mockEventBus.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await service.expireOrder('order-123');

      expect(result).toBe(true);
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-123', status: OrderStatus.PENDING },
        data: { status: OrderStatus.EXPIRED },
      });
      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderExpiredEvent),
      );
    });

    it('thanh cong ngay ca khi eventBus.publish throw error (khong lam fail expireOrder)', async () => {
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { orderId: 'order-123', seatShowtimeId: 'sst-1' },
      ]);

      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);
      (mockEventBus.publish as jest.Mock).mockRejectedValue(
        new Error('Event bus listener failure'),
      );

      const result = await service.expireOrder('order-123');

      expect(result).toBe(true);
      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderExpiredEvent),
      );
    });

    it('idempotent: khong doi status va khong nha ghe neu order da PAID hoac CANCELLED hoac khong tim thay', async () => {
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.expireOrder('order-paid');

      expect(result).toBe(false);
      expect(mockPrisma.seatOrder.findMany).not.toHaveBeenCalled();
      expect(mockShowtimeBooking.releaseSeats).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('getOrderDetail', () => {
    it('tra ve chi tiet don hang thanh cong kem ve, san pham va khuyen mai', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.productOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          orderId: 'order-123',
          productId: 'prod-001',
          quantity: 2,
          unitPrice: 65000,
        },
      ]);

      const res = await service.getOrderDetail('order-123');

      expect(res.orderId).toBe('order-123');
      expect(res.tickets).toHaveLength(1);
      expect(res.tickets[0].ticketCode).toBe('TK-123');
      expect(res.products).toHaveLength(1);
      expect(res.products[0].productName).toBe('Bắp rang bơ');
      expect(res.products[0].subTotal).toBe(130000);
      expect(res.promotion).toBeDefined();
      expect(res.promotion?.promotionCode).toBe('SALE20');
      expect(
        mockTicketContract.getTicketsByOrderId as jest.Mock,
      ).toHaveBeenCalledWith('order-123');
      expect(
        mockProductContract.getProductsByIds as jest.Mock,
      ).toHaveBeenCalledWith(['prod-001']);
      expect(
        mockPromotionContract.getPromotionById as jest.Mock,
      ).toHaveBeenCalledWith('promo-001');
    });

    it('nem NotFoundException khi don hang khong ton tai', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(() => service.getOrderDetail('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fallback sang seatOrder va showtimeBookingService khi don chua co ve (PENDING/CANCELLED/EXPIRED)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PENDING,
      });

      (mockTicketContract.getTicketsByOrderId as jest.Mock).mockResolvedValue(
        [],
      );

      mockPrisma.seatOrder.findMany.mockResolvedValue([
        {
          orderId: 'order-123',
          seatShowtimeId: 'sst-1',
          price: 100000,
        },
      ]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);

      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'F',
          columnPosition: 8,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 95000,
          startTime: new Date('2026-03-30T14:00:00Z'),
          endTime: new Date('2026-03-30T16:00:00Z'),
          roomId: 'room-1',
          roomName: 'Phòng 1',
          movieId: 'movie-1',
          movieName: 'Mai',
        },
      ]);

      const res = await service.getOrderDetail('order-123');

      expect(res.orderId).toBe('order-123');
      expect(res.tickets).toHaveLength(1);
      expect(res.tickets[0].ticketId).toBe('sst-1');
      expect(res.tickets[0].ticketCode).toBe('');
      expect(res.tickets[0].price).toBe(100000);
      expect(res.tickets[0].ticketStatus).toBe(OrderStatus.PENDING);
      expect(res.tickets[0].movieTitle).toBe('Mai');
      expect(res.tickets[0].roomName).toBe('Phòng 1');
      expect(res.tickets[0].seatLabel).toBe('F8');
      expect(mockShowtimeBooking.getSeatBookingDetails).toHaveBeenCalledWith([
        'sst-1',
      ]);
    });
  });

  describe('applyPromotion', () => {
    it('ap dung ma giam gia thanh cong cho don hang PENDING', async () => {
      const mockPendingOrder = {
        id: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        {
          orderId: 'order-apply',
          seatShowtimeId: 'sst-1',
          price: 100000,
        },
      ]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);

      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'show-1',
          seatId: 'seat-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: 'STANDARD',
          seatStatus: 'RESERVED',
          basePrice: 100000,
        },
      ]);

      (
        mockPromotionContract.validatePromotionCode as jest.Mock
      ).mockResolvedValue({
        isValid: true,
        promotionId: 'promo-001',
        promotionCode: 'SALE20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        discountAmount: 20000,
      });

      const res = await service.applyPromotion('user-001', 'order-apply', {
        promotionCode: 'SALE20',
      });

      expect(res.orderId).toBe('order-apply');
      expect(res.totalAmount).toBe(80000);
      expect(res.promotion).toBeDefined();
      expect(res.promotion?.discountAmount).toBe(20000);
      expect(res.promotion?.promotionCode).toBe('SALE20');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-apply' },
        data: {
          promotionId: 'promo-001',
          totalAmount: 80000,
        },
      });
    });

    it('nem BadRequestException khi ma khuyen mai khong hop le', async () => {
      const mockPendingOrder = {
        id: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);

      (
        mockPromotionContract.validatePromotionCode as jest.Mock
      ).mockResolvedValue({
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion has expired',
      });

      await expect(
        service.applyPromotion('user-001', 'order-apply', {
          promotionCode: 'EXPIRED_CODE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nem ForbiddenException khi sai chu so huu don hang', async () => {
      const mockPendingOrder = {
        id: 'order-apply',
        userId: 'other-user',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);

      await expect(
        service.applyPromotion('user-001', 'order-apply', {
          promotionCode: 'SALE20',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nem BadRequestException khi don khong o trang thai PENDING', async () => {
      const mockPaidOrder = {
        id: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PAID,
        createdAt: new Date(),
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPaidOrder);

      await expect(
        service.applyPromotion('user-001', 'order-apply', {
          promotionCode: 'SALE20',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyOrderHistory', () => {
    const setupPaginateMocks = (orders = [mockOrder], total = 1) => {
      mockPrisma.order.findMany.mockResolvedValue(orders);
      mockPrisma.order.count.mockResolvedValue(total);
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { orderId: 'order-123', seatShowtimeId: 'sst-1' },
      ]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);
    };

    it('loc theo mot status don le', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {
        status: OrderStatus.PAID,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-001',
            status: OrderStatus.PAID,
          },
        }),
      );
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-001',
          status: OrderStatus.PAID,
        },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('loc theo nhieu status phan tach bang dau phay (CANCELLED,EXPIRED)', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-001',
            status: { in: ['CANCELLED', 'EXPIRED'] },
          },
        }),
      );
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-001',
          status: { in: ['CANCELLED', 'EXPIRED'] },
        },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('tra ve tat ca khi khong truyen status', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {});

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-001',
          },
        }),
      );
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-001',
        },
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('queryStaffOrders and queryAdminOrders with multi-status', () => {
    const setupPaginateMocks = () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.seatOrder.findMany.mockResolvedValue([]);
      mockPrisma.productOrder.findMany.mockResolvedValue([]);
    };

    it('queryStaffOrders loc theo nhieu status', async () => {
      setupPaginateMocks();

      await service.queryStaffOrders({
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['CANCELLED', 'EXPIRED'] },
          },
        }),
      );
    });

    it('queryAdminOrders loc theo nhieu status', async () => {
      setupPaginateMocks();

      await service.queryAdminOrders({
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['CANCELLED', 'EXPIRED'] },
          },
        }),
      );
    });
  });

  describe('QueryMyOrdersReq validation', () => {
    it('hop le voi status don le', async () => {
      const dto = plainToInstance(QueryMyOrdersReq, { status: 'CANCELLED' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('hop le voi status phan tach bang dau phay', async () => {
      const dto = plainToInstance(QueryMyOrdersReq, {
        status: 'CANCELLED,EXPIRED',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('khong hop le voi status sai', async () => {
      const dto = plainToInstance(QueryMyOrdersReq, {
        status: 'INVALID_STATUS',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.matches).toBeDefined();
    });

    it('khong hop le khi co status hop le kem status sai', async () => {
      const dto = plainToInstance(QueryMyOrdersReq, {
        status: 'CANCELLED,INVALID',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('cancelOrder', () => {
    it('huy don PENDING thanh cong cho Customer chinh chu, nha ghe va ban event', async () => {
      const mockPendingOrder = {
        id: 'order-cancel-1',
        userId: 'user-001',
        status: OrderStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([
        { orderId: 'order-cancel-1', seatShowtimeId: 'sst-1' },
      ]);
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);

      const res = await service.cancelOrder(
        'order-cancel-1',
        { userId: 'user-001', role: 'USER' },
        'Khong muon xem nua',
      );

      expect(res.orderId).toBe('order-cancel-1');
      expect(res.status).toBe(OrderStatus.CANCELLED);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-cancel-1' },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('nem ForbiddenException khi Customer huy don cua nguoi khac', async () => {
      const mockPendingOrder = {
        id: 'order-cancel-1',
        userId: 'other-user',
        status: OrderStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);

      await expect(
        service.cancelOrder('order-cancel-1', {
          userId: 'user-001',
          role: 'USER',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nem BadRequestException khi don khong o trang thai PENDING', async () => {
      const mockPaidOrder = {
        id: 'order-cancel-1',
        userId: 'user-001',
        status: OrderStatus.PAID,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPaidOrder);

      await expect(
        service.cancelOrder('order-cancel-1', {
          userId: 'user-001',
          role: 'USER',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('huy don PENDING thanh cong cho Staff cung chi nhanh', async () => {
      const mockPendingOrder = {
        id: 'order-cancel-1',
        userId: 'staff-01',
        branchId: 'branch-01',
        status: OrderStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([]);

      const res = await service.cancelOrder('order-cancel-1', {
        userId: 'staff-01',
        role: 'STAFF',
        branchId: 'branch-01',
      });

      expect(res.status).toBe(OrderStatus.CANCELLED);
    });

    it('nem ForbiddenException khi Staff huy don khac chi nhanh', async () => {
      const mockPendingOrder = {
        id: 'order-cancel-1',
        userId: 'staff-01',
        branchId: 'branch-02',
        status: OrderStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);

      await expect(
        service.cancelOrder('order-cancel-1', {
          userId: 'staff-01',
          role: 'STAFF',
          branchId: 'branch-01',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Admin co the huy bat ky don PENDING nao', async () => {
      const mockPendingOrder = {
        id: 'order-cancel-1',
        userId: 'user-any',
        branchId: 'branch-any',
        status: OrderStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockPendingOrder);
      mockPrisma.seatOrder.findMany.mockResolvedValue([]);

      const res = await service.cancelOrder('order-cancel-1', {
        userId: 'admin-01',
        role: 'ADMIN',
      });

      expect(res.status).toBe(OrderStatus.CANCELLED);
    });
  });
});
