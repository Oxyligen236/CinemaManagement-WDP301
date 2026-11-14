import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { OrderService } from '../../application/services/order.service';
import { OrderAdminController } from './order-admin.controller';

describe('OrderAdminController', () => {
  let controller: OrderAdminController;
  const mockOrderService = {
    queryAdminOrders: jest.fn(),
    cancelOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderAdminController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrderAdminController);
  });

  it('delegates getAdminOrders to orderService.queryAdminOrders', async () => {
    const query = { page: 1, limit: 10, userId: 'u-1' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    mockOrderService.queryAdminOrders.mockResolvedValue(expected);

    const res = await controller.getAdminOrders(query);
    expect(res).toBe(expected);
    expect(mockOrderService.queryAdminOrders).toHaveBeenCalledWith(query);
  });

  it('cancels order using userId or sub and optional reason', async () => {
    mockOrderService.cancelOrder.mockResolvedValue({
      orderId: 'ord-1',
      status: 'CANCELLED',
    });

    await controller.cancelAdminOrder(
      'ord-1',
      { reason: 'Admin cancel' },
      { user: { userId: 'admin-1' } },
    );
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-1',
      { userId: 'admin-1', role: Role.ADMIN },
      'Admin cancel',
    );

    await controller.cancelAdminOrder(
      'ord-2',
      {} as any,
      { user: { sub: 'admin-2' } },
    );
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-2',
      { userId: 'admin-2', role: Role.ADMIN },
      undefined,
    );
  });

  it('throws UnauthorizedException when adminId is missing', async () => {
    await expect(
      controller.cancelAdminOrder('ord-1', {}, { user: {} }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockOrderService.cancelOrder).not.toHaveBeenCalled();
  });
});
