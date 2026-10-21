import { OrderStatus } from '../../domain/enums/order-status.enum';
import {
  OrderDetailRes,
  OrderItemProductRes,
  OrderItemTicketRes,
  OrderSummaryRes,
  PromotionSummaryRes,
} from './res.dto';

describe('Order Module Response DTOs', () => {
  describe('OrderSummaryRes', () => {
    it('maps correctly via of()', () => {
      const date = new Date('2026-10-21T10:00:00.000Z');
      const raw = {
        orderId: 'ord-100',
        userId: 'usr-1',
        totalAmount: 250000,
        status: OrderStatus.PENDING,
        createdAt: date,
        ticketCount: 2,
        hasProducts: true,
      };

      const res = OrderSummaryRes.of(raw);
      expect(res).toBeInstanceOf(OrderSummaryRes);
      expect(res.orderId).toBe('ord-100');
      expect(res.userId).toBe('usr-1');
      expect(res.totalAmount).toBe(250000);
      expect(res.status).toBe(OrderStatus.PENDING);
      expect(res.createdAt).toEqual(date);
      expect(res.ticketCount).toBe(2);
      expect(res.hasProducts).toBe(true);
    });

    it('handles ofArray()', () => {
      expect(OrderSummaryRes.ofArray([])).toEqual([]);
      expect(OrderSummaryRes.ofArray(undefined)).toEqual([]);

      const list = OrderSummaryRes.ofArray([
        { orderId: 'ord-1', totalAmount: 100000 },
        { orderId: 'ord-2', totalAmount: 200000 },
      ]);
      expect(list).toHaveLength(2);
      expect(list[0]).toBeInstanceOf(OrderSummaryRes);
      expect(list[1].orderId).toBe('ord-2');
    });
  });

  describe('OrderItemProductRes', () => {
    it('maps correctly via of() and ofArray()', () => {
      const raw = {
        productId: 'p-1',
        productName: 'Popcorn',
        imageUrl: 'http://img.jpg',
        quantity: 2,
        unitPrice: 45000,
        subTotal: 90000,
      };

      const res = OrderItemProductRes.of(raw);
      expect(res).toBeInstanceOf(OrderItemProductRes);
      expect(res.productId).toBe('p-1');
      expect(res.subTotal).toBe(90000);

      const list = OrderItemProductRes.ofArray([raw]);
      expect(list).toHaveLength(1);
      expect(list[0]).toBeInstanceOf(OrderItemProductRes);
    });
  });

  describe('OrderItemTicketRes', () => {
    it('maps correctly via of() and ofArray()', () => {
      const raw = {
        ticketId: 't-1',
        ticketCode: 'TCK-001',
        price: 75000,
        ticketStatus: 'VALID',
        movieTitle: 'Avengers',
        roomName: 'Hall 1',
        seatLabel: 'A1',
        startTime: new Date(),
      };

      const res = OrderItemTicketRes.of(raw);
      expect(res).toBeInstanceOf(OrderItemTicketRes);
      expect(res.ticketId).toBe('t-1');
      expect(res.ticketCode).toBe('TCK-001');

      const list = OrderItemTicketRes.ofArray([raw]);
      expect(list).toHaveLength(1);
      expect(list[0]).toBeInstanceOf(OrderItemTicketRes);
    });
  });

  describe('OrderDetailRes', () => {
    it('maps nested tickets, products, and promotion', () => {
      const raw = {
        orderId: 'ord-detail-1',
        userId: 'usr-1',
        totalAmount: 120000,
        status: OrderStatus.PAID,
        createdAt: new Date(),
        tickets: [
          {
            ticketId: 't-1',
            ticketCode: 'TCK-1',
            price: 60000,
            ticketStatus: 'VALID',
            movieTitle: 'Movie A',
            roomName: 'Room 1',
            seatLabel: 'B2',
            startTime: new Date(),
          },
        ],
        products: [
          {
            productId: 'p-1',
            productName: 'Coke',
            quantity: 2,
            unitPrice: 30000,
            subTotal: 60000,
          },
        ],
        promotion: {
          promotionId: 'promo-1',
          promotionCode: 'DISCOUNT10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          discountAmount: 10000,
        },
      };

      const res = OrderDetailRes.of(raw);
      expect(res).toBeInstanceOf(OrderDetailRes);
      expect(res.orderId).toBe('ord-detail-1');
      expect(res.tickets).toHaveLength(1);
      expect(res.tickets[0]).toBeInstanceOf(OrderItemTicketRes);
      expect(res.products).toHaveLength(1);
      expect(res.products[0]).toBeInstanceOf(OrderItemProductRes);
      expect(res.promotion).toBeInstanceOf(PromotionSummaryRes);
      expect(res.promotion?.promotionCode).toBe('DISCOUNT10');
    });
  });
});
