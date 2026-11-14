import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

const mockBuildPaymentUrl = jest.fn(
  (params: { vnp_TxnRef: string; vnp_Amount: number }) =>
    `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${params.vnp_TxnRef}&vnp_Amount=${params.vnp_Amount}`,
);
const mockVerifyReturnUrl = jest.fn();
const mockVerifyIpnCall = jest.fn();

jest.mock('vnpay', () => ({
  VNPay: jest.fn().mockImplementation(() => ({
    buildPaymentUrl: mockBuildPaymentUrl,
    verifyReturnUrl: mockVerifyReturnUrl,
    verifyIpnCall: mockVerifyIpnCall,
  })),
  ignoreLogger: jest.fn(),
}));

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

    it('trả về transactionId undefined nếu DB lưu null', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-004',
        orderId: 'ord-004',
        amount: 80000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        transactionId: null,
      });

      const res = await service.checkPaymentStatus('ord-004');
      expect(res.transactionId).toBeUndefined();
    });
  });

  describe('VNPay full flows & error branches', () => {
    it('createVnpayPayment ném lỗi khi thiếu env hoặc amount không hợp lệ', async () => {
      mockOrderService.getOrderForOnlinePayment.mockResolvedValue({
        orderId: 'ord-1',
        totalAmount: 100000,
      });

      delete process.env.VNPAY_RETURN_URL;
      await expect(
        service.createVnpayPayment('u-1', 'ord-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);

      process.env.VNPAY_RETURN_URL = 'http://localhost:8010/return';
      delete process.env.VNPAY_TMN_CODE;
      await expect(
        service.createVnpayPayment('u-1', 'ord-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);

      process.env.VNPAY_TMN_CODE = 'TEST_TMN';
      mockOrderService.getOrderForOnlinePayment.mockResolvedValue({
        orderId: 'ord-1',
        totalAmount: 0,
      });
      await expect(
        service.createVnpayPayment('u-1', 'ord-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('createVnpayPayment tái sử dụng pending payment hoặc ném lỗi nếu lệch amount', async () => {
      mockOrderService.getOrderForOnlinePayment.mockResolvedValue({
        orderId: 'ord-1',
        totalAmount: 150000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-existing',
        orderId: 'ord-1',
        amount: 150000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const reused = await service.createVnpayPayment('u-1', 'ord-1', '127.0.0.1');
      expect(reused.paymentId).toBe('pay-existing');
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();

      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-existing',
        orderId: 'ord-1',
        amount: 120000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });
      await expect(
        service.createVnpayPayment('u-1', 'ord-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('handleVnpayReturn không fulfill khi thất bại', async () => {
      mockVerifyReturnUrl.mockReturnValue({
        isVerified: true,
        isSuccess: false,
        vnp_Amount: 180000,
        message: 'Cancelled',
      });
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        orderId: 'ord-1',
        amount: 180000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const res = await service.handleVnpayReturn({
        vnp_TxnRef: 'pay-1',
        vnp_ResponseCode: '24',
      });
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('24');
      expect(mockOrderService.fulfillVnpayOrder).not.toHaveBeenCalled();
    });

    it('verifyVnpayReturn xử lý thiếu env, không thấy payment, sai checksum/amount và success', async () => {
      delete process.env.VNPAY_HASH_SECRET;
      await expect(
        service.verifyVnpayReturn({ vnp_TxnRef: 'pay-1' }),
      ).rejects.toThrow(BadRequestException);

      process.env.VNPAY_HASH_SECRET = 'SECRET';
      mockVerifyReturnUrl.mockReturnValue({
        isVerified: true,
        isSuccess: true,
        vnp_Amount: 180000,
        message: 'OK',
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.verifyVnpayReturn({ vnp_TxnRef: ['not-string'] }),
      ).rejects.toThrow(NotFoundException);

      mockVerifyReturnUrl.mockReturnValueOnce({
        isVerified: false,
        isSuccess: true,
        vnp_Amount: 180000,
        message: 'Bad sig',
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-1',
        orderId: 'ord-1',
        amount: 180000,
      });
      await expect(
        service.verifyVnpayReturn({ vnp_TxnRef: 'pay-1' }),
      ).rejects.toThrow(BadRequestException);

      mockVerifyReturnUrl.mockReturnValueOnce({
        isVerified: true,
        isSuccess: true,
        vnp_Amount: 180000,
        message: 'OK',
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-1',
        orderId: 'ord-1',
        amount: 180000,
      });
      const ok = await service.verifyVnpayReturn({ vnp_TxnRef: 'pay-1' });
      expect(ok).toEqual({
        isSuccess: true,
        orderId: 'ord-1',
        message: 'OK',
        responseCode: '',
      });
    });

    it('handleVnpayIpn và verifyVnpayIpn xử lý đầy đủ RspCode (97, 01, 04, 02, 00 idempotent & update)', async () => {
      delete process.env.VNPAY_TMN_CODE;
      await expect(service.handleVnpayIpn({})).rejects.toThrow(
        BadRequestException,
      );
      process.env.VNPAY_TMN_CODE = 'TEST_TMN';

      // RspCode 97: invalid checksum
      mockVerifyIpnCall.mockReturnValueOnce({ isVerified: false });
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p1' })).toEqual({
        RspCode: '97',
        Message: 'Invalid checksum',
      });

      // RspCode 01: order not found
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        vnp_TxnRef: 'p-missing',
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p-missing' })).toEqual(
        {
          RspCode: '01',
          Message: 'Order not found',
        },
      );

      // RspCode 04: invalid amount
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        vnp_TxnRef: 'p1',
        vnp_Amount: 50000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'p1',
        orderId: 'ord-1',
        amount: 100000,
        status: PaymentStatus.PENDING,
      });
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p1' })).toEqual({
        RspCode: '04',
        Message: 'Invalid amount',
      });

      // Already SUCCESS -> 00 idempotent & calls fulfillVnpayOrder
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        vnp_TxnRef: 'p1',
        vnp_Amount: 100000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'p1',
        orderId: 'ord-1',
        amount: 100000,
        status: PaymentStatus.SUCCESS,
      });
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p1' })).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      expect(mockOrderService.fulfillVnpayOrder).toHaveBeenCalledWith('ord-1');

      // Already FAILED -> 02
      mockOrderService.fulfillVnpayOrder.mockClear();
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        vnp_TxnRef: 'p1',
        vnp_Amount: 100000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'p1',
        orderId: 'ord-1',
        amount: 100000,
        status: PaymentStatus.FAILED,
      });
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p1' })).toEqual({
        RspCode: '02',
        Message: 'Order already confirmed',
        orderId: 'ord-1',
        isSuccess: false,
      });
      expect(mockOrderService.fulfillVnpayOrder).not.toHaveBeenCalled();

      // PENDING -> FAILED update without fulfillVnpayOrder
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        isSuccess: false,
        vnp_TxnRef: 'p1',
        vnp_Amount: 100000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'p1',
        orderId: 'ord-1',
        amount: 100000,
        status: PaymentStatus.PENDING,
      });
      const failedUpdate = await service.handleVnpayIpn({ vnp_TxnRef: 'p1' });
      expect(failedUpdate).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
        orderId: 'ord-1',
        isSuccess: false,
      });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: PaymentStatus.FAILED, transactionId: '' },
      });

      // PENDING -> SUCCESS update & fulfillVnpayOrder
      mockVerifyIpnCall.mockReturnValueOnce({
        isVerified: true,
        isSuccess: true,
        vnp_TxnRef: 'p1',
        vnp_Amount: 100000,
        vnp_TransactionNo: 'VNP123',
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'p1',
        orderId: 'ord-1',
        amount: 100000,
        status: PaymentStatus.PENDING,
      });
      expect(await service.handleVnpayIpn({ vnp_TxnRef: 'p1' })).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: PaymentStatus.SUCCESS, transactionId: 'VNP123' },
      });
      expect(mockOrderService.fulfillVnpayOrder).toHaveBeenCalledWith('ord-1');
    });

    it('getVnpayPaymentStatus trả về true khi SUCCESS và false khi không', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        status: PaymentStatus.SUCCESS,
      });
      expect(await service.getVnpayPaymentStatus('ord-1')).toEqual({
        isSuccess: true,
      });

      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
      expect(await service.getVnpayPaymentStatus('ord-1')).toEqual({
        isSuccess: false,
      });
    });

    it('generateQrPayment tái sử dụng pending payment hiện có', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-pending',
        orderId: 'ord-qr',
        amount: 150000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });

      const res = await service.generateQrPayment({
        orderId: 'ord-qr',
        amount: 150000,
        description: 'Custom Desc',
      });

      expect(res.paymentId).toBe('pay-pending');
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('các nhánh lỗi và fallback cho POS payment', async () => {
      // confirmPosCashPayment non-PENDING
      mockPosOrderService.getOrderForPosPayment.mockResolvedValueOnce({
        orderId: 'ord-pos',
        status: 'PAID',
        totalAmount: 100000,
      });
      await expect(
        service.confirmPosCashPayment(staffContext, 'ord-pos', {
          cashReceived: 100000,
        }),
      ).rejects.toThrow(BadRequestException);

      // initiatePosQrPayment non-PENDING
      mockPosOrderService.getOrderForPosPayment.mockResolvedValueOnce({
        orderId: 'ord-pos',
        status: 'EXPIRED',
        totalAmount: 100000,
      });
      await expect(
        service.initiatePosQrPayment(staffContext, 'ord-pos', {
          paymentMethod: PaymentMethod.VNPAY,
        }),
      ).rejects.toThrow(BadRequestException);

      // checkPosPaymentStatus when order already PAID (updatedAt present and missing)
      const paidAt = new Date('2026-04-01T10:00:00.000Z');
      mockPosOrderService.getOrderForPosPayment.mockResolvedValueOnce({
        orderId: 'ord-pos',
        status: 'PAID',
        totalAmount: 120000,
        updatedAt: paidAt,
      });
      mockOrderService.getPaidOrderTickets.mockResolvedValueOnce([]);
      const paidRes = (await service.checkPosPaymentStatus(
        staffContext,
        'ord-pos',
      )) as PosCashPaymentResultRes;
      expect(paidRes.status).toBe('PAID');
      expect(paidRes.paidAt).toEqual(paidAt);

      mockPosOrderService.getOrderForPosPayment.mockResolvedValueOnce({
        orderId: 'ord-pos',
        status: 'PAID',
        totalAmount: 120000,
      });
      mockOrderService.getPaidOrderTickets.mockResolvedValueOnce([]);
      const paidResFallback = (await service.checkPosPaymentStatus(
        staffContext,
        'ord-pos',
      )) as PosCashPaymentResultRes;
      expect(paidResFallback.paidAt).toBeInstanceOf(Date);

      // checkPosPaymentStatus when payment is still PENDING
      mockPosOrderService.getOrderForPosPayment.mockResolvedValueOnce({
        orderId: 'ord-pos',
        status: 'PENDING',
        totalAmount: 120000,
      });
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'pay-pend',
        orderId: 'ord-pos',
        amount: 120000,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        transactionId: null,
      });
      const pendingRes = await service.checkPosPaymentStatus(
        staffContext,
        'ord-pos',
      );
      expect(pendingRes).toMatchObject({
        orderId: 'ord-pos',
        paymentId: 'pay-pend',
        paymentStatus: PaymentStatus.PENDING,
        qrCodeUrl: '',
        qrPayload: '',
      });
    });
  });
});
