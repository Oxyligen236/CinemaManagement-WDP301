import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { PaymentService } from '../../application/services/payment.service';
import { OrderPaymentController } from './order-payment.controller';

describe('OrderPaymentController', () => {
  let controller: OrderPaymentController;
  const mockPaymentService = {
    createVnpayPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderPaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrderPaymentController);
  });

  it('creates VNPay payment using userId or sub', async () => {
    mockPaymentService.createVnpayPayment.mockResolvedValue({
      paymentId: 'pay-1',
      paymentUrl: 'https://vnpay.test',
    });

    const res1 = await controller.createVnpayPayment(
      { user: { userId: 'u-1' } },
      'ord-1',
      '127.0.0.1',
    );
    expect(res1.paymentId).toBe('pay-1');
    expect(mockPaymentService.createVnpayPayment).toHaveBeenCalledWith(
      'u-1',
      'ord-1',
      '127.0.0.1',
    );

    await controller.createVnpayPayment(
      { user: { sub: 'u-2' } },
      'ord-2',
      '::1',
    );
    expect(mockPaymentService.createVnpayPayment).toHaveBeenCalledWith(
      'u-2',
      'ord-2',
      '::1',
    );
  });

  it('throws UnauthorizedException when userId and sub are missing', async () => {
    await expect(
      controller.createVnpayPayment({ user: {} }, 'ord-1', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPaymentService.createVnpayPayment).not.toHaveBeenCalled();
  });
});
