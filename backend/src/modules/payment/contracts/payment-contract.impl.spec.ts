import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentContractImpl } from './payment-contract.impl';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('PaymentContractImpl', () => {
  let contract: PaymentContractImpl;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    contract = new PaymentContractImpl(mockPrisma as unknown as PrismaService);
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

      const res = await contract.processCashPayment({
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
        contract.processCashPayment({
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
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
      });

      const res = await contract.generateQrPayment({
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
        contract.generateQrPayment({
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

      const res = await contract.checkPaymentStatus('ord-003');
      expect(res.orderId).toBe('ord-003');
      expect(res.status).toBe(PaymentStatus.SUCCESS);
    });

    it('ném lỗi NotFoundException khi không tìm thấy thanh toán', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(contract.checkPaymentStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
