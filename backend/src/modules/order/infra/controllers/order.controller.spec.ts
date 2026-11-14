import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from '../../application/services/order.service';
import { OrderStatus } from '../../domain/enums/order-status.enum';
import { CreateBookingOrderReq } from '../../application/dto/req.dto';
import { BookingSummaryRes } from '../../application/dto/res.dto';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { Role } from '../../../auth/infra/decorators/role.decorator';

describe('OrderController', () => {
  let controller: OrderController;

  const mockOrderService = {
    createBookingOrder: jest.fn(),
    getBookingSummary: jest.fn(),
    applyPromotion: jest.fn(),
    getMyOrderHistory: jest.fn(),
    getOrderDetail: jest.fn(),
    cancelOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrderController>(OrderController);
  });

  describe('POST /orders/booking', () => {
    it('tao booking thanh cong khi co userId trong token', async () => {
      const expectedRes: BookingSummaryRes = {
        orderId: 'order-123',
        userId: 'user-001',
        status: OrderStatus.PENDING,
        totalAmount: 95000,
        createdAt: new Date(),
        expiresAt: new Date(),
        remainingSeconds: 600,
        seats: [],
        products: [],
      };

      mockOrderService.createBookingOrder.mockResolvedValue(expectedRes);

      const req = { user: { userId: 'user-001' } };
      const body: CreateBookingOrderReq = {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
      };

      const res = await controller.createBooking(req, body);

      expect(res).toBe(expectedRes);
      expect(mockOrderService.createBookingOrder).toHaveBeenCalledWith(
        'user-001',
        body,
      );
    });

    it('nem UnauthorizedException khi khong co userId trong token', async () => {
      const req = { user: {} };
      const body: CreateBookingOrderReq = {
        showtimeId: 'show-1',
        seatShowtimeIds: ['sst-1'],
      };

      await expect(controller.createBooking(req, body)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockOrderService.createBookingOrder).not.toHaveBeenCalled();
    });
  });

  describe('GET /orders/:orderId/summary', () => {
    it('lay booking summary thanh cong khi co userId', async () => {
      const expectedRes: BookingSummaryRes = {
        orderId: 'order-123',
        userId: 'user-001',
        status: OrderStatus.PENDING,
        totalAmount: 95000,
        createdAt: new Date(),
        expiresAt: new Date(),
        remainingSeconds: 580,
        seats: [],
        products: [],
      };

      mockOrderService.getBookingSummary.mockResolvedValue(expectedRes);

      const req = { user: { userId: 'user-001' } };
      const res = await controller.getBookingSummary(req, 'order-123');

      expect(res).toBe(expectedRes);
      expect(mockOrderService.getBookingSummary).toHaveBeenCalledWith(
        'user-001',
        'order-123',
      );
    });

    it('nem UnauthorizedException khi khong co userId', async () => {
      const req = { user: {} };

      await expect(
        controller.getBookingSummary(req, 'order-123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockOrderService.getBookingSummary).not.toHaveBeenCalled();
    });
  });

  describe('POST /orders/:orderId/apply-promotion', () => {
    it('ap dung ma khuyen mai thanh cong', async () => {
      const expectedRes: BookingSummaryRes = {
        orderId: 'order-123',
        userId: 'user-001',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
        createdAt: new Date(),
        expiresAt: new Date(),
        remainingSeconds: 580,
        seats: [],
        products: [],
        promotion: {
          promotionId: 'promo-1',
          promotionCode: 'SALE20',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          discountAmount: 20000,
        },
      };

      mockOrderService.applyPromotion.mockResolvedValue(expectedRes);

      const req = { user: { userId: 'user-001' } };
      const body = { promotionCode: 'SALE20' };

      const res = await controller.applyPromotion(req, 'order-123', body);

      expect(res).toBe(expectedRes);
      expect(mockOrderService.applyPromotion).toHaveBeenCalledWith(
        'user-001',
        'order-123',
        body,
      );
    });

    it('nem UnauthorizedException khi khong co userId trong token', async () => {
      const req = { user: {} };
      const body = { promotionCode: 'SALE20' };

      await expect(
        controller.applyPromotion(req, 'order-123', body),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockOrderService.applyPromotion).not.toHaveBeenCalled();
    });
  });

  describe('GET /orders/me, POST /orders/:orderId/cancel, GET /orders/:orderId', () => {
    it('getMyOrders dung userId, sub hoac fallback user-default', async () => {
      const page = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      mockOrderService.getMyOrderHistory.mockResolvedValue(page);

      const query = { page: 1, limit: 10 };
      await controller.getMyOrders({ user: { userId: 'u-1' } }, query);
      expect(mockOrderService.getMyOrderHistory).toHaveBeenCalledWith(
        'u-1',
        query,
      );

      await controller.getMyOrders({ user: { sub: 'u-2' } }, query);
      expect(mockOrderService.getMyOrderHistory).toHaveBeenCalledWith(
        'u-2',
        query,
      );

      await controller.getMyOrders({}, query);
      expect(mockOrderService.getMyOrderHistory).toHaveBeenCalledWith(
        'user-default',
        query,
      );
    });

    it('cancelCustomerOrder huy don thanh cong va nem UnauthorizedException khi thieu user', async () => {
      await expect(
        controller.cancelCustomerOrder({ user: {} }, 'ord-1', {}),
      ).rejects.toThrow(UnauthorizedException);

      mockOrderService.cancelOrder.mockResolvedValue({
        orderId: 'ord-1',
        status: OrderStatus.CANCELLED,
      });
      await controller.cancelCustomerOrder(
        { user: { sub: 'u-1' } },
        'ord-1',
        { reason: 'Changed mind' },
      );
      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
        'ord-1',
        { userId: 'u-1', role: Role.USER },
        'Changed mind',
      );
    });

    it('getOrderDetail goi orderService.getOrderDetail', async () => {
      const detail = { orderId: 'ord-1' };
      mockOrderService.getOrderDetail.mockResolvedValue(detail);

      const res = await controller.getOrderDetail('ord-1');
      expect(res).toBe(detail);
      expect(mockOrderService.getOrderDetail).toHaveBeenCalledWith('ord-1');
    });
  });
});
