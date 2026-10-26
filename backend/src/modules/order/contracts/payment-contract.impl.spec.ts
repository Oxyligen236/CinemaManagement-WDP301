import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentContractImpl } from './payment-contract.impl';
import { Payment } from '../../payment/domain/schemas/payment.schema';
import { PaymentMethod } from '../../payment/domain/enums/payment-method.enum';
import { PaymentStatus } from '../../payment/domain/enums/payment-status.enum';

describe('PaymentContractImpl', () => {
  let contract: PaymentContractImpl;

  const mockSavedPayment = {
    paymentId: 'pay-001',
    orderId: 'ord-001',
    amount: 100000,
    method: PaymentMethod.CASH,
    status: PaymentStatus.SUCCESS,
    transactionId: 'CASH-1234',
    save: jest.fn(),
  };

  function MockPaymentConstructor(dto: any) {
    return {
      ...dto,
      save: jest.fn().mockResolvedValue({
        ...dto,
        paymentId: dto.paymentId || 'pay-001',
      }),
    };
  }
  MockPaymentConstructor.findOne = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentContractImpl,
        {
          provide: getModelToken(Payment.name),
          useValue: MockPaymentConstructor,
        },
      ],
    }).compile();

    contract = module.get<PaymentContractImpl>(PaymentContractImpl);
  });

  describe('processCashPayment', () => {
    it('thanh toán tiền mặt thành công khi khách đưa đủ tiền', async () => {
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
      MockPaymentConstructor.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
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
      MockPaymentConstructor.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              paymentId: 'pay-003',
              orderId: 'ord-003',
              amount: 80000,
              method: PaymentMethod.CASH,
              status: PaymentStatus.SUCCESS,
              transactionId: 'TXN-123',
            }),
          }),
        }),
      });

      const res = await contract.checkPaymentStatus('ord-003');
      expect(res.orderId).toBe('ord-003');
      expect(res.status).toBe(PaymentStatus.SUCCESS);
    });

    it('ném lỗi NotFoundException khi không tìm thấy thanh toán', async () => {
      MockPaymentConstructor.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(contract.checkPaymentStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
