/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from '../../domain/schemas/order.schema';
import { SeatOrder } from '../../domain/schemas/seat-order.schema';
import { ProductOrder } from '../../domain/schemas/product-order.schema';
import { OrderStatus } from '../../domain/enums/order-status.enum';
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
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryMyOrdersReq } from '../dto/req.dto';

describe('OrderService', () => {
  let service: OrderService;

  const mockOrder = {
    orderId: 'order-123',
    userId: 'user-001',
    totalAmount: 180000,
    status: OrderStatus.PAID,
    promotionId: 'promo-001',
    createdAt: new Date('2026-03-30T10:00:00Z'),
  };

  const mockOrderModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const mockSeatOrderModel = {
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const mockProductOrderModel = {
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken(SeatOrder.name),
          useValue: mockSeatOrderModel,
        },
        {
          provide: getModelToken(ProductOrder.name),
          useValue: mockProductOrderModel,
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
      mockOrderModel.create.mockResolvedValue({});
      mockSeatOrderModel.insertMany.mockResolvedValue({});
      mockProductOrderModel.insertMany.mockResolvedValue({});
      (mockQueueService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventBus.publish as jest.Mock).mockResolvedValue(undefined);

      const res = await service.createBookingOrder('user-001', {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
        products: [{ productId: 'prod-001', quantity: 1 }],
      });

      expect(mockShowtimeBooking.reserveSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          status: OrderStatus.PENDING,
          totalAmount: 160000,
        }),
      );
      expect(mockSeatOrderModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockProductOrderModel.insertMany).toHaveBeenCalledTimes(1);
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

      expect(mockOrderModel.create).not.toHaveBeenCalled();
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
      mockOrderModel.create.mockResolvedValue({});
      mockSeatOrderModel.insertMany.mockResolvedValue({});
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
      expect(mockOrderModel.deleteOne).toHaveBeenCalled();
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
      mockOrderModel.create.mockResolvedValue({});
      mockSeatOrderModel.insertMany.mockResolvedValue({});
      mockProductOrderModel.insertMany.mockResolvedValue({});
      (mockQueueService.publish as jest.Mock).mockResolvedValue(undefined);
      (mockEventBus.publish as jest.Mock).mockRejectedValue(
        new Error('Event bus listener failure'),
      );

      const res = await service.createBookingOrder('user-001', {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
      });

      expect(res.status).toBe(OrderStatus.PENDING);
      expect(mockOrderModel.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderCreatedEvent),
      );
    });
  });

  describe('getBookingSummary', () => {
    it('lay booking summary thanh cong cho chu so huu', async () => {
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            orderId: 'order-123',
            userId: 'user-001',
            status: OrderStatus.PENDING,
            totalAmount: 95000,
            createdAt: new Date(),
          }),
        }),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValue([
              { orderId: 'order-123', seatShowtimeId: 'sst-1', price: 95000 },
            ]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

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
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            orderId: 'order-123',
            userId: 'another-user',
            status: OrderStatus.PENDING,
            totalAmount: 95000,
            createdAt: new Date(),
          }),
        }),
      });

      await expect(
        service.getBookingSummary('user-001', 'order-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nem NotFoundException khi don hang khong ton tai', async () => {
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.getBookingSummary('user-001', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('expireOrder', () => {
    it('expire order thanh cong: PENDING -> EXPIRED, nha ghe RESERVED -> EMPTY, event emitted', async () => {
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            orderId: 'order-123',
            status: OrderStatus.EXPIRED,
          }),
        }),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValue([
              { orderId: 'order-123', seatShowtimeId: 'sst-1' },
            ]),
        }),
      });

      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);
      (mockEventBus.publish as jest.Mock).mockResolvedValue(undefined);

      const result = await service.expireOrder('order-123');

      expect(result).toBe(true);
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: 'order-123', status: OrderStatus.PENDING },
        { $set: { status: OrderStatus.EXPIRED } },
        { new: true },
      );
      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(OrderExpiredEvent),
      );
    });

    it('thanh cong ngay ca khi eventBus.publish throw error (khong lam fail expireOrder)', async () => {
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            orderId: 'order-123',
            status: OrderStatus.EXPIRED,
          }),
        }),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValue([
              { orderId: 'order-123', seatShowtimeId: 'sst-1' },
            ]),
        }),
      });

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
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.expireOrder('order-paid');

      expect(result).toBe(false);
      expect(mockSeatOrderModel.find).not.toHaveBeenCalled();
      expect(mockShowtimeBooking.releaseSeats).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('getOrderDetail', () => {
    it('tra ve chi tiet don hang thanh cong kem ve, san pham va khuyen mai', async () => {
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(mockOrder),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([
            {
              productOrderId: 'po-1',
              orderId: 'order-123',
              productId: 'prod-001',
              quantity: 2,
              unitPrice: 65000,
            },
          ]),
        }),
      });

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
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(() => service.getOrderDetail('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fallback sang seatOrder va showtimeBookingService khi don chua co ve (PENDING/CANCELLED/EXPIRED)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            ...mockOrder,
            status: OrderStatus.PENDING,
          }),
        }),
      });

      (mockTicketContract.getTicketsByOrderId as jest.Mock).mockResolvedValue(
        [],
      );

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([
            {
              orderId: 'order-123',
              seatShowtimeId: 'sst-1',
              price: 100000,
            },
          ]),
        }),
      });

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

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

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
        orderId: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPendingOrder),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([
            {
              orderId: 'order-apply',
              seatShowtimeId: 'sst-1',
              price: 100000,
            },
          ]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

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
      expect(mockPendingOrder.save).toHaveBeenCalled();
    });

    it('nem BadRequestException khi ma khuyen mai khong hop le', async () => {
      const mockPendingOrder = {
        orderId: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPendingOrder),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

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
        orderId: 'order-apply',
        userId: 'other-user',
        totalAmount: 100000,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPendingOrder),
      });

      await expect(
        service.applyPromotion('user-001', 'order-apply', {
          promotionCode: 'SALE20',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nem BadRequestException khi don khong o trang thai PENDING', async () => {
      const mockPaidOrder = {
        orderId: 'order-apply',
        userId: 'user-001',
        totalAmount: 100000,
        status: OrderStatus.PAID,
        createdAt: new Date(),
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPaidOrder),
      });

      await expect(
        service.applyPromotion('user-001', 'order-apply', {
          promotionCode: 'SALE20',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyOrderHistory', () => {
    const setupPaginateMocks = (orders = [mockOrder], total = 1) => {
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(orders),
              }),
            }),
          }),
        }),
      });

      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(total),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([
              { orderId: 'order-123', seatShowtimeId: 'sst-1' },
            ]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
    };

    it('loc theo mot status don le', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {
        status: OrderStatus.PAID,
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        userId: 'user-001',
        status: OrderStatus.PAID,
      });
      expect(mockOrderModel.countDocuments).toHaveBeenCalledWith({
        userId: 'user-001',
        status: OrderStatus.PAID,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('loc theo nhieu status phan tach bang dau phay (CANCELLED,EXPIRED)', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        userId: 'user-001',
        status: { $in: ['CANCELLED', 'EXPIRED'] },
      });
      expect(mockOrderModel.countDocuments).toHaveBeenCalledWith({
        userId: 'user-001',
        status: { $in: ['CANCELLED', 'EXPIRED'] },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('tra ve tat ca khi khong truyen status', async () => {
      setupPaginateMocks();

      const result = await service.getMyOrderHistory('user-001', {});

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        userId: 'user-001',
      });
      expect(mockOrderModel.countDocuments).toHaveBeenCalledWith({
        userId: 'user-001',
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('queryStaffOrders and queryAdminOrders with multi-status', () => {
    const setupPaginateMocks = () => {
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockOrder]),
              }),
            }),
          }),
        }),
      });

      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
    };

    it('queryStaffOrders loc theo nhieu status', async () => {
      setupPaginateMocks();

      await service.queryStaffOrders({
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        status: { $in: ['CANCELLED', 'EXPIRED'] },
      });
    });

    it('queryAdminOrders loc theo nhieu status', async () => {
      setupPaginateMocks();

      await service.queryAdminOrders({
        status: 'CANCELLED,EXPIRED',
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        status: { $in: ['CANCELLED', 'EXPIRED'] },
      });
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
});
