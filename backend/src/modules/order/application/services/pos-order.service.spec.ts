/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PosOrderService } from './pos-order.service';
import { Order } from '../../domain/schemas/order.schema';
import { SeatOrder } from '../../domain/schemas/seat-order.schema';
import { ProductOrder } from '../../domain/schemas/product-order.schema';
import { OrderStatus } from '../../domain/enums/order-status.enum';
import {
  TICKET_CONTRACT,
  TicketContract,
} from '../../contracts/ticket.contract';
import {
  PRODUCT_CONTRACT,
  ProductContract,
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
  PAYMENT_CONTRACT,
  PaymentContract,
  PaymentMethod,
  PaymentStatus,
} from '../../contracts/payment.contract';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { PosCashPaymentResultRes } from '../dto/res.dto';

describe('PosOrderService', () => {
  let service: PosOrderService;

  const staffContext = {
    staffId: 'staff-001',
    branchId: 'branch-hn-01',
    staffName: 'Nguyen Van A',
  };

  const mockOrder = {
    _id: new Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    orderId: 'order-pos-123',
    userId: 'staff-001',
    totalAmount: 180000,
    status: OrderStatus.PENDING,
    save: jest.fn().mockResolvedValue(true),
  };

  const mockOrderModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
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

  const mockShowtimeBooking: ShowtimeBookingContract = {
    reserveSeats: jest.fn(),
    releaseSeats: jest.fn(),
    getSeatBookingDetails: jest.fn(),
    confirmSeats: jest.fn(),
  };

  const mockTicketContract: TicketContract = {
    getTicketsByOrderId: jest.fn(),
    createTicketsForOrder: jest.fn(),
  };

  const mockProductContract: ProductContract = {
    getProductsByIds: jest.fn(),
    deductConcessionStock: jest.fn(),
  };

  const mockPromotionContract: PromotionContract = {
    getPromotionById: jest.fn(),
    validatePromotionCode: jest.fn(),
    recordPromotionUsage: jest.fn(),
  };

  const mockPaymentContract: PaymentContract = {
    processCashPayment: jest.fn(),
    generateQrPayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
    createVnpayPayment: jest.fn(),
    verifyVnpayReturn: jest.fn(),
    verifyVnpayIpn: jest.fn(),
    getVnpayPaymentStatus: jest.fn(),
  };

  const mockQueueService: QueueService = {
    publish: jest.fn().mockResolvedValue('job-pos-001'),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  const mockEventBus: InternalEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosOrderService,
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
          provide: SHOWTIME_BOOKING,
          useValue: mockShowtimeBooking,
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
          provide: PAYMENT_CONTRACT,
          useValue: mockPaymentContract,
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

    service = module.get<PosOrderService>(PosOrderService);
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
      (mockProductContract.getProductsByIds as jest.Mock).mockResolvedValue(
        prodMap,
      );
      mockOrderModel.create.mockResolvedValue({});
      mockProductOrderModel.insertMany.mockResolvedValue([]);

      const result = await service.createPosBookingOrder(staffContext, {
        products: [{ productId: 'prod-1', quantity: 2 }],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.totalAmount).toBe(120000);
      expect(result.seats).toHaveLength(0);
      expect(mockShowtimeBooking.reserveSeats).not.toHaveBeenCalled();
      expect(mockSeatOrderModel.insertMany).not.toHaveBeenCalled();
      expect(mockOrderModel.create).toHaveBeenCalledWith({
        _id: expect.any(Types.ObjectId),
        userId: staffContext.staffId,
        branchId: staffContext.branchId,
        totalAmount: 120000,
        status: OrderStatus.PENDING,
      });
    });

    it('should throw ForbiddenException if reserved seats belong to different branch', async () => {
      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          basePrice: 90000,
          branchId: 'branch-other',
        },
      ]);
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);

      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: ['sst-1'],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
    });

    it('should throw ForbiddenException if products belong to different branch', async () => {
      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue([
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
      (mockProductContract.getProductsByIds as jest.Mock).mockResolvedValue(
        prodMap,
      );
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);

      await expect(
        service.createPosBookingOrder(staffContext, {
          showtimeId: 'st-01',
          seatShowtimeIds: ['sst-1'],
          products: [{ productId: 'prod-1', quantity: 1 }],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
    });

    it('should create POS booking order without saving old 9 fields', async () => {
      (mockShowtimeBooking.reserveSeats as jest.Mock).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          showtimeId: 'st-01',
          seatId: 's-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: 'STANDARD',
          basePrice: 90000,
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
      (mockProductContract.getProductsByIds as jest.Mock).mockResolvedValue(
        prodMap,
      );
      mockOrderModel.create.mockResolvedValue({});
      mockSeatOrderModel.insertMany.mockResolvedValue([]);
      mockProductOrderModel.insertMany.mockResolvedValue([]);

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
      const expectedCreatedOrder: Record<string, unknown> = {
        _id: expect.any(Types.ObjectId),
        userId: staffContext.staffId,
        branchId: staffContext.branchId,
        totalAmount: 150000,
        status: OrderStatus.PENDING,
      };
      expect(mockOrderModel.create).toHaveBeenCalledWith(expectedCreatedOrder);
      expect(mockQueueService.publish).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('cancelPosOrder & verifyOrderBranch', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.cancelPosOrder(staffContext, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order belongs to different branch via seats', async () => {
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.PENDING,
        }),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
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
        ...mockOrder,
        status: OrderStatus.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderToCancel),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      (mockShowtimeBooking.releaseSeats as jest.Mock).mockResolvedValue(1);

      const res = await service.cancelPosOrder(staffContext, 'order-pos-123');

      expect(res.success).toBe(true);
      expect(orderToCancel.status).toBe(OrderStatus.CANCELLED);
      expect(mockShowtimeBooking.releaseSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('confirmPosCashPayment', () => {
    it('should throw BadRequestException if cash received is less than totalAmount', async () => {
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.PENDING,
          totalAmount: 150000,
        }),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.confirmPosCashPayment(staffContext, 'order-pos-123', {
          cashReceived: 100000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should confirm cash payment using totalAmount, issue tickets, and update order to PAID', async () => {
      const pendingOrder = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        totalAmount: 150000,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendingOrder),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      (mockPaymentContract.processCashPayment as jest.Mock).mockResolvedValue({
        paymentId: 'pay-001',
        changeAmount: 50000,
        paidAt: new Date(),
      });
      mockProductOrderModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ productId: 'prod-1', quantity: 1 }]),
      });
      (mockShowtimeBooking.confirmSeats as jest.Mock).mockResolvedValue(1);
      (mockTicketContract.createTicketsForOrder as jest.Mock).mockResolvedValue(
        [
          {
            ticketId: 't-1',
            ticketCode: 'TK-20261025-001',
            price: 90000,
            ticketStatus: 'VALID',
          },
        ],
      );
      (
        mockProductContract.deductConcessionStock as jest.Mock
      ).mockResolvedValue(undefined);

      const res = await service.confirmPosCashPayment(
        staffContext,
        'order-pos-123',
        { cashReceived: 200000 },
      );

      expect(res.status).toBe(OrderStatus.PAID);
      expect(res.totalAmount).toBe(150000);
      expect(res.changeAmount).toBe(50000);
      expect(res.tickets).toHaveLength(1);
      expect(mockPaymentContract.processCashPayment).toHaveBeenCalledWith({
        orderId: 'order-pos-123',
        totalAmount: 150000,
        cashReceived: 200000,
      });
      expect(mockShowtimeBooking.confirmSeats).toHaveBeenCalledWith(['sst-1']);
      expect(mockProductContract.deductConcessionStock).toHaveBeenCalled();
      expect(pendingOrder.status).toBe(OrderStatus.PAID);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-pos-123',
          totalAmount: 150000,
          paymentMethod: 'CASH',
          userId: 'staff-001',
        }),
      );
    });
  });

  describe('initiatePosQrPayment', () => {
    it('should initiate QR payment using totalAmount and return QR payload', async () => {
      const pendingOrder = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        totalAmount: 180000,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendingOrder),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      (mockPaymentContract.generateQrPayment as jest.Mock).mockResolvedValue({
        paymentId: 'pay-qr-001',
        status: PaymentStatus.PENDING,
        qrCodeUrl: 'https://qr.vietqr.io/image.png',
        qrPayload: 'vietqr://payload',
      });

      const res = await service.initiatePosQrPayment(
        staffContext,
        'order-pos-123',
        { paymentMethod: PaymentMethod.VNPAY },
      );

      expect(res.paymentId).toBe('pay-qr-001');
      expect(res.amount).toBe(180000);
      expect(res.qrCodeUrl).toBe('https://qr.vietqr.io/image.png');
      expect(mockPaymentContract.generateQrPayment).toHaveBeenCalledWith({
        orderId: 'order-pos-123',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        description: 'Thanh toan ve quay order-pos-123',
      });
    });
  });

  describe('checkPosPaymentStatus', () => {
    it('should complete order when status is SUCCESS and publish OrderPaidEvent', async () => {
      const pendingOrder = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        totalAmount: 180000,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendingOrder),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      (mockPaymentContract.checkPaymentStatus as jest.Mock).mockResolvedValue({
        paymentId: 'pay-qr-001',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.SUCCESS,
      });
      mockProductOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      (mockShowtimeBooking.confirmSeats as jest.Mock).mockResolvedValue(1);
      (mockTicketContract.createTicketsForOrder as jest.Mock).mockResolvedValue(
        [
          {
            ticketId: 't-1',
            ticketCode: 'TK-01',
            price: 90000,
            ticketStatus: 'VALID',
          },
        ],
      );

      const res = (await service.checkPosPaymentStatus(
        staffContext,
        'order-pos-123',
      )) as PosCashPaymentResultRes;

      expect(res.status).toBe(OrderStatus.PAID);
      expect(res.totalAmount).toBe(180000);
      expect(res.tickets).toHaveLength(1);
      expect(mockShowtimeBooking.confirmSeats).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-pos-123',
          totalAmount: 180000,
          paymentMethod: PaymentMethod.VNPAY,
          userId: 'staff-001',
        }),
      );
    });
  });

  describe('getPosReceipt', () => {
    it('should return receipt data with actual paymentMethod from PaymentContract and totalAmount', async () => {
      const paidOrder = {
        ...mockOrder,
        status: OrderStatus.PAID,
        totalAmount: 180000,
      };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(paidOrder),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ seatShowtimeId: 'sst-1' }]),
      });
      (
        mockShowtimeBooking.getSeatBookingDetails as jest.Mock
      ).mockResolvedValue([
        {
          seatShowtimeId: 'sst-1',
          branchId: 'branch-hn-01',
        },
      ]);
      (mockPaymentContract.checkPaymentStatus as jest.Mock).mockResolvedValue({
        paymentId: 'pay-001',
        amount: 180000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
      });
      (mockTicketContract.getTicketsByOrderId as jest.Mock).mockResolvedValue([
        {
          ticketCode: 'TK-123',
          movieTitle: 'Kung Fu Panda 4',
          roomName: 'P01',
          seatLabel: 'A1',
          startTime: new Date(),
          endTime: new Date(),
          price: 90000,
        },
      ]);
      mockProductOrderModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { productId: 'prod-1', quantity: 2, unitPrice: 45000 },
          ]),
      });
      const prodMap = new Map();
      prodMap.set('prod-1', { productName: 'Bắp bơ', unitPrice: 45000 });
      (mockProductContract.getProductsByIds as jest.Mock).mockResolvedValue(
        prodMap,
      );

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
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.PENDING,
        }),
      });
      mockSeatOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.getPosReceipt(staffContext, 'order-pos-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
