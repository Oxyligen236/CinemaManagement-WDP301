/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
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
  ProductSummaryDto,
} from '../../contracts/product.contract';
import {
  PROMOTION_CONTRACT,
  PromotionContract,
} from '../../contracts/promotion.contract';

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
  };

  const mockSeatOrderModel = {
    find: jest.fn(),
  };

  const mockProductOrderModel = {
    find: jest.fn(),
  };

  const mockTicketContract: TicketContract = {
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
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
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
  });

  describe('getMyOrderHistory', () => {
    it('phan trang danh sach don hang cua user', async () => {
      const orders = [mockOrder];
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: () => ({
          exec: jest.fn().mockResolvedValue(orders),
        }),
      });
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      mockSeatOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValue([{ orderId: 'order-123', seatOrderId: 'so-1' }]),
        }),
      });

      mockProductOrderModel.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getMyOrderHistory('user-001', {
        page: 1,
        limit: 10,
        status: OrderStatus.PAID,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].orderId).toBe('order-123');
      expect(result.items[0].ticketCount).toBe(1);
      expect(result.items[0].hasProducts).toBe(false);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('queryStaffOrders', () => {
    it('phan trang danh sach don hang cho staff', async () => {
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: () => ({
          exec: jest.fn().mockResolvedValue([mockOrder]),
        }),
      });
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
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

      const result = await service.queryStaffOrders({
        page: 1,
        limit: 10,
        date: '2026-03-30',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('queryAdminOrders', () => {
    it('phan trang danh sach don hang cho admin', async () => {
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: () => ({
          exec: jest.fn().mockResolvedValue([mockOrder]),
        }),
      });
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
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

      const result = await service.queryAdminOrders({
        page: 1,
        limit: 10,
        userId: 'user-001',
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
