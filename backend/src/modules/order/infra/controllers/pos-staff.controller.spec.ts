import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { OrderService } from '../../application/services/order.service';
import { PosOrderService } from '../../application/services/pos-order.service';
import { PosStaffController } from './pos-staff.controller';

describe('PosStaffController', () => {
  let controller: PosStaffController;

  const mockOrderService = {
    cancelOrder: jest.fn(),
  };

  const mockPosOrderService = {
    createPosBookingOrder: jest.fn(),
    applyPosPromotion: jest.fn(),
    getPosReceipt: jest.fn(),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const req = { user: { sub: 'staff-1', role: Role.STAFF } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosStaffController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: PosOrderService, useValue: mockPosOrderService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PosStaffController);
  });

  it('throws ForbiddenException when staff is missing, without branchId, or inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      controller.createPosBookingOrder(req, { seatShowtimeIds: ['sst-1'] }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      branchId: null,
      isActive: true,
    });
    await expect(
      controller.applyPromotion(req, 'ord-1', { promotionCode: 'SALE' }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      branchId: 'br-1',
      isActive: false,
    });
    await expect(controller.getPosReceipt(req, 'ord-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('forwards createPosBookingOrder, applyPromotion, cancelPosOrder, and getPosReceipt with staffContext', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      branchId: 'br-1',
      firstName: 'Minh',
      lastName: 'Tran',
      isActive: true,
    });

    await controller.createPosBookingOrder(req, { seatShowtimeIds: ['sst-1'] });
    expect(mockPosOrderService.createPosBookingOrder).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'Minh Tran' },
      { seatShowtimeIds: ['sst-1'] },
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      branchId: 'br-1',
      firstName: null,
      lastName: null,
      isActive: true,
    });
    await controller.applyPromotion(req, 'ord-1', { promotionCode: 'VIP10' });
    expect(mockPosOrderService.applyPosPromotion).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'Thu ngân' },
      'ord-1',
      { promotionCode: 'VIP10' },
    );

    await controller.cancelPosOrder(req, 'ord-1', { reason: 'Sai ghế' });
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-1',
      { userId: 'staff-1', role: Role.STAFF, branchId: 'br-1' },
      'Sai ghế',
    );

    await controller.cancelPosOrder(req, 'ord-2');
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-2',
      { userId: 'staff-1', role: Role.STAFF, branchId: 'br-1' },
      undefined,
    );

    await controller.getPosReceipt(req, 'ord-1');
    expect(mockPosOrderService.getPosReceipt).toHaveBeenCalledWith(
      { staffId: 'staff-1', branchId: 'br-1', staffName: 'Thu ngân' },
      'ord-1',
    );
  });
});
