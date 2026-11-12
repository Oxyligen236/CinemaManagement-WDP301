import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { OrderService } from '../../../order/application/services/order.service';
import { PosOrderService } from '../../../order/application/services/pos-order.service';
import { PaymentService } from './payment.service';
import { PaymentMethod } from '../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PosCashPaymentResultRes } from '../dto/res.dto';

describe('PaymentService', () => {
  let service: PaymentService;

  const staffContext = {
    staffId: 'staff-001',
    branchId: 'branch-hn-01',
  };

  const mockPrisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockOrderService = {
    getOrderForOnlinePayment: jest.fn(),
    getPaidOrderTickets: jest.fn(),
    fulfillOrderPayment: jest.fn(),
    fulfillVnpayOrder: jest.fn(),
  };

  const mockPosOrderService = {
    getOrderForPosPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.VNPAY_RETURN_URL =
      'http://localhost:8010/payments/vnpay/return';
    process.env.VNPAY_TMN_CODE = 'TEST_TMN_CODE';
    process.env.VNPAY_HASH_SECRET = 'TEST_VNPAY_HASH_SECRET_123456';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: PosOrderService,
          useValue: mockPosOrderService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('createVnpayPayment', () => {
    it('should validate order and build VNPay payment URL', async () => {
      mockOrderService.getOrderForOnlinePayment.mockResolvedValue({
        orderId: 'order-1',
        totalAmount: 180000,
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        orderId: 'order-1',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const res = await service.createVnpayPayment(
        'user-1',
        'order-1',
        '127.0.0.1',
      );

      expect(mockOrderService.getOrderForOnlinePayment).toHaveBeenCalledWith(
        'user-1',
        'order-1',
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          amount: 180000,
          method: PaymentMethod.VNPAY,
          status: PaymentStatus.PENDING,
        },
      });
      expect(res.paymentId).toBe('pay-1');
      expect(res.orderId).toBe('order-1');
      expect(res.status).toBe(PaymentStatus.PENDING);
      expect(res.paymentUrl).toContain('vnp_TxnRef=pay-1');
    });
  });

  describe('handleVnpayReturn & handleVnpayIpn', () => {
    it('should fulfill order on successful VNPay return', async () => {
      jest.spyOn(service, 'verifyVnpayReturn').mockResolvedValue({
        isSuccess: true,
        orderId: 'order-1',
        message: 'Success',
        responseCode: '00',
      });
      mockOrderService.fulfillVnpayOrder.mockResolvedValue({
        RspCode: '00',
        Message: 'Confirm Success',
      });

      const res = await service.handleVnpayReturn({ vnp_TxnRef: 'pay-1' });
      expect(res.isSuccess).toBe(true);
      expect(mockOrderService.fulfillVnpayOrder).toHaveBeenCalledWith(
        'order-1',
      );
    });

    it('should fulfill order on valid VNPay IPN', async () => {
      jest.spyOn(service, 'verifyVnpayIpn').mockResolvedValue({
        RspCode: '00',
        Message: 'Confirm Success',
        orderId: 'order-1',
        isSuccess: true,
      });
      mockOrderService.fulfillVnpayOrder.mockResolvedValue({
        RspCode: '00',
        Message: 'Confirm Success',
      });

      const res = await service.handleVnpayIpn({ vnp_TxnRef: 'pay-1' });
      expect(res).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(mockOrderService.fulfillVnpayOrder).toHaveBeenCalledWith(
        'order-1',
      );
    });
  });

  describe('confirmPosCashPayment', () => {
    it('should throw BadRequestException if cash received is less than totalAmount', async () => {
      mockPosOrderService.getOrderForPosPayment.mockResolvedValue({
        orderId: 'order-pos-123',
        userId: 'staff-001',
        branchId: 'branch-hn-01',
        totalAmount: 150000,
        status: 'PENDING',
      });

      await expect(
        service.confirmPosCashPayment(staffContext, 'order-pos-123', {
          cashReceived: 100000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process cash payment and fulfill order', async () => {
      mockPosOrderService.getOrderForPosPayment.mockResolvedValue({
        orderId: 'order-pos-123',
        userId: 'staff-001',
        branchId: 'branch-hn-01',
        totalAmount: 150000,
        status: 'PENDING',
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-001',
        orderId: 'order-pos-123',
        amount: 150000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
      });
      mockOrderService.fulfillOrderPayment.mockResolvedValue({
        tickets: [
          {
            ticketId: 't-1',
            ticketCode: 'TK-20261025-001',
            price: 90000,
            ticketStatus: 'VALID',
            seatShowtimeId: 'sst-1',
            movieTitle: 'Mai',
            roomName: 'Cinema 01',
            seatLabel: 'F8',
            startTime: new Date('2026-03-30T14:00:00Z'),
            endTime: new Date('2026-03-30T16:00:00Z'),
          },
        ],
        paidAt: new Date('2026-03-30T10:00:00Z'),
      });

      const res = await service.confirmPosCashPayment(
        staffContext,
        'order-pos-123',
        { cashReceived: 200000 },
      );

      expect(res.status).toBe('PAID');
      expect(res.totalAmount).toBe(150000);
      expect(res.changeAmount).toBe(50000);
      expect(res.tickets).toHaveLength(1);
      expect(mockOrderService.fulfillOrderPayment).toHaveBeenCalledWith(
        'order-pos-123',
        'pay-001',
        {
          paymentMethod: 'CASH',
          branchId: 'branch-hn-01',
          staffId: 'staff-001',
        },
      );
    });
  });

  describe('initiatePosQrPayment', () => {
    it('should initiate QR payment using totalAmount and return QR payload', async () => {
      mockPosOrderService.getOrderForPosPayment.mockResolvedValue({
        orderId: 'order-pos-123',
        userId: 'staff-001',
        branchId: 'branch-hn-01',
        totalAmount: 180000,
        status: 'PENDING',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-qr-001',
        orderId: 'order-pos-123',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const res = await service.initiatePosQrPayment(
        staffContext,
        'order-pos-123',
        { paymentMethod: PaymentMethod.VNPAY },
      );

      expect(res.paymentId).toBe('pay-qr-001');
      expect(res.amount).toBe(180000);
      expect(res.qrCodeUrl).toContain('vietqr.io');
    });
  });

  describe('checkPosPaymentStatus', () => {
    it('should fulfill order when payment status is SUCCESS', async () => {
      mockPosOrderService.getOrderForPosPayment.mockResolvedValue({
        orderId: 'order-pos-123',
        userId: 'staff-001',
        branchId: 'branch-hn-01',
        totalAmount: 180000,
        status: 'PENDING',
      });
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-qr-001',
        orderId: 'order-pos-123',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.SUCCESS,
      });
      mockOrderService.fulfillOrderPayment.mockResolvedValue({
        tickets: [
          {
            ticketId: 't-1',
            ticketCode: 'TK-01',
            price: 90000,
            ticketStatus: 'VALID',
            seatShowtimeId: 'sst-1',
            movieTitle: 'Mai',
            roomName: 'Cinema 01',
            seatLabel: 'F8',
            startTime: new Date('2026-03-30T14:00:00Z'),
            endTime: new Date('2026-03-30T16:00:00Z'),
          },
        ],
        paidAt: new Date('2026-03-30T10:00:00Z'),
      });

      const res = (await service.checkPosPaymentStatus(
        staffContext,
        'order-pos-123',
      )) as PosCashPaymentResultRes;

      expect(res.status).toBe('PAID');
      expect(res.totalAmount).toBe(180000);
      expect(res.tickets).toHaveLength(1);
      expect(mockOrderService.fulfillOrderPayment).toHaveBeenCalledWith(
        'order-pos-123',
        'pay-qr-001',
        {
          paymentMethod: PaymentMethod.VNPAY,
          branchId: 'branch-hn-01',
          staffId: 'staff-001',
        },
      );
    });
  });

  describe('processCashPayment', () => {
    it('thanh toán tiền mặt thành công khi khách đưa đủ tiền', async () => {
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-001',
        orderId: 'ord-001',
        amount: 100000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
      });

      const res = await service.processCashPayment({
        orderId: 'ord-001',
        totalAmount: 100000,
        cashReceived: 120000,
      });

      expect(res.orderId).toBe('ord-001');
      expect(res.amount).toBe(100000);
      expect(res.cashReceived).toBe(120000);
      expect(res.changeAmount).toBe(20000);
      expect(res.status).toBe(PaymentStatus.SUCCESS);
      expect(res.method).toBe(PaymentMethod.CASH);
    });

    it('ném lỗi BadRequestException khi tiền khách đưa nhỏ hơn tổng tiền', async () => {
      await expect(
        service.processCashPayment({
          orderId: 'ord-001',
          totalAmount: 100000,
          cashReceived: 90000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateQrPayment', () => {
    it('sinh mã QR thanh toán thành công', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-002',
        orderId: 'ord-002',
        amount: 150000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const res = await service.generateQrPayment({
        orderId: 'ord-002',
        amount: 150000,
      });

      expect(res.orderId).toBe('ord-002');
      expect(res.amount).toBe(150000);
      expect(res.status).toBe(PaymentStatus.PENDING);
      expect(res.qrCodeUrl).toContain('vietqr.io');
    });

    it('ném lỗi BadRequestException khi amount <= 0', async () => {
      await expect(
        service.generateQrPayment({
          orderId: 'ord-002',
          amount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkPaymentStatus', () => {
    it('trả về thông tin giao dịch nếu tìm thấy', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-003',
        orderId: 'ord-003',
        amount: 80000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        transactionId: 'TXN-123',
      });

      const res = await service.checkPaymentStatus('ord-003');
      expect(res.orderId).toBe('ord-003');
      expect(res.status).toBe(PaymentStatus.SUCCESS);
    });

    it('ném lỗi NotFoundException khi không tìm thấy thanh toán', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.checkPaymentStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
