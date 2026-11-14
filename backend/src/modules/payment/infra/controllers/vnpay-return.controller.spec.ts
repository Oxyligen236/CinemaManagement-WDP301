import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../../application/services/payment.service';
import { VnpayReturnController } from './vnpay-return.controller';

describe('VnpayReturnController', () => {
  let controller: VnpayReturnController;
  const mockPaymentService = {
    handleVnpayIpn: jest.fn(),
    handleVnpayReturn: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.FRONTEND_URL;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VnpayReturnController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile();

    controller = module.get(VnpayReturnController);
  });

  it('delegates IPN query to paymentService.handleVnpayIpn', async () => {
    mockPaymentService.handleVnpayIpn.mockResolvedValue({
      RspCode: '00',
      Message: 'Confirm Success',
    });

    const res = await controller.handleIpn({ vnp_TxnRef: 'pay-1' });
    expect(res).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(mockPaymentService.handleVnpayIpn).toHaveBeenCalledWith({
      vnp_TxnRef: 'pay-1',
    });
  });

  it('redirects with success params when handleVnpayReturn succeeds', async () => {
    process.env.FRONTEND_URL = 'https://cinema.example.com';
    const response = { redirect: jest.fn() } as any;
    mockPaymentService.handleVnpayReturn.mockResolvedValue({
      orderId: 'ord-1',
      isSuccess: true,
      responseCode: '00',
      message: 'OK',
    });

    await controller.handleReturn({ vnp_TxnRef: 'pay-1' }, response);

    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://cinema.example.com/booking/payment-return?',
      ),
    );
    const redirectedUrl = response.redirect.mock.calls[0][0] as string;
    const url = new URL(redirectedUrl);
    expect(url.searchParams.get('orderId')).toBe('ord-1');
    expect(url.searchParams.get('status')).toBe('success');
    expect(url.searchParams.get('code')).toBe('00');
    expect(url.searchParams.get('message')).toBe('OK');
  });

  it('redirects with failed params and fallback values when not successful', async () => {
    const response = { redirect: jest.fn() } as any;
    mockPaymentService.handleVnpayReturn.mockResolvedValue({
      isSuccess: false,
    });

    await controller.handleReturn({ vnp_TxnRef: ['bad'] }, response);

    const url = new URL(response.redirect.mock.calls[0][0] as string);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.searchParams.get('orderId')).toBe('');
    expect(url.searchParams.get('status')).toBe('failed');
    expect(url.searchParams.get('code')).toBe('UNKNOWN');
    expect(url.searchParams.get('message')).toBe('Thanh toán không thành công');
  });

  it('handles handleVnpayReturn throwing error with and without string vnp_ResponseCode', async () => {
    const response = { redirect: jest.fn() } as any;
    mockPaymentService.handleVnpayReturn.mockRejectedValue(
      new Error('invalid sig'),
    );

    await controller.handleReturn(
      { vnp_TxnRef: 'pay-9', vnp_ResponseCode: '24' },
      response,
    );
    let url = new URL(response.redirect.mock.calls[0][0] as string);
    expect(url.searchParams.get('orderId')).toBe('pay-9');
    expect(url.searchParams.get('code')).toBe('24');
    expect(url.searchParams.get('message')).toBe('Giao dịch không thành công');

    await controller.handleReturn({ vnp_TxnRef: ['arr'] }, response);
    url = new URL(response.redirect.mock.calls[1][0] as string);
    expect(url.searchParams.get('orderId')).toBe('');
    expect(url.searchParams.get('code')).toBe('SYSTEM_ERROR');
    expect(url.searchParams.get('message')).toBe('Không thể xác nhận giao dịch');
  });
});
