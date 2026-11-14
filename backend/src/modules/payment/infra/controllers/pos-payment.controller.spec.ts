import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { PaymentService } from '../../application/services/payment.service';
import { PaymentMethod } from '../../domain/enums/payment-method.enum';
import { PosPaymentController } from './pos-payment.controller';

describe('PosPaymentController', () => {
  let controller: PosPaymentController;

  const mockPaymentService = {
    confirmPosCashPayment: jest.fn(),
    initiatePosQrPayment: jest.fn(),
    checkPosPaymentStatus: jest.fn(),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const req = { user: { sub: 'staff-1', role: 'STAFF' } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosPaymentController],
      providers: [
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PosPaymentController);
  });

  it('throws ForbiddenException when staff is missing, unassigned, or inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      controller.confirmPosCashPayment(req, 'ord-1', { cashReceived: 100000 }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      branchId: null,
      isActive: true,
    });
    await expect(
      controller.initiatePosQrPayment(req, 'ord-1', {
        paymentMethod: PaymentMethod.VNPAY,
      }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      branchId: 'br-1',
      isActive: false,
    });
    await expect(
      controller.checkPosPaymentStatus(req, 'ord-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resolves staffContext (with and without name) and forwards to PaymentService', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      branchId: 'br-1',
      firstName: 'An',
      lastName: 'Nguyen',
      isActive: true,
    });
    mockPaymentService.confirmPosCashPayment.mockResolvedValue({
      status: 'PAID',
    });

    await controller.confirmPosCashPayment(req, 'ord-1', {
      cashReceived: 200000,
    });
    expect(mockPaymentService.confirmPosCashPayment).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'An Nguyen' },
      'ord-1',
      { cashReceived: 200000 },
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      branchId: 'br-1',
      firstName: null,
      lastName: null,
      isActive: true,
    });
    mockPaymentService.initiatePosQrPayment.mockResolvedValue({
      paymentId: 'pay-qr',
    });
    await controller.initiatePosQrPayment(req, 'ord-1', {
      paymentMethod: PaymentMethod.VNPAY,
    });
    expect(mockPaymentService.initiatePosQrPayment).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'Thu ngân' },
      'ord-1',
      { paymentMethod: PaymentMethod.VNPAY },
    );

    mockPaymentService.checkPosPaymentStatus.mockResolvedValue({
      paymentId: 'pay-qr',
    });
    await controller.checkPosPaymentStatus(req, 'ord-1');
    expect(mockPaymentService.checkPosPaymentStatus).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'Thu ngân' },
      'ord-1',
    );
  });
});
