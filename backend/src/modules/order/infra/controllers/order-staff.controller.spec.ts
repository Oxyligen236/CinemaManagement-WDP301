import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { OrderService } from '../../application/services/order.service';
import { OrderStaffController } from './order-staff.controller';

describe('OrderStaffController', () => {
  let controller: OrderStaffController;
  const mockOrderService = {
    queryStaffOrders: jest.fn(),
    cancelOrder: jest.fn(),
  };
  const mockUserBranchQueryService = {
    getBranchIdOfUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderStaffController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        {
          provide: UserBranchQueryService,
          useValue: mockUserBranchQueryService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrderStaffController);
  });

  it('delegates getStaffOrders to orderService.queryStaffOrders', async () => {
    const query = { page: 1, limit: 10, status: 'PENDING' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    mockOrderService.queryStaffOrders.mockResolvedValue(expected);

    const res = await controller.getStaffOrders(query);
    expect(res).toBe(expected);
    expect(mockOrderService.queryStaffOrders).toHaveBeenCalledWith(query);
  });

  it('throws UnauthorizedException when staffId is missing', async () => {
    await expect(
      controller.cancelStaffOrder('ord-1', {}, { user: {} }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockOrderService.cancelOrder).not.toHaveBeenCalled();
  });

  it('resolves branchId (string or null fallback) and calls cancelOrder', async () => {
    mockUserBranchQueryService.getBranchIdOfUser.mockResolvedValueOnce('br-1');
    mockOrderService.cancelOrder.mockResolvedValue({ status: 'CANCELLED' });

    await controller.cancelStaffOrder(
      'ord-1',
      { reason: 'Khách đổi lịch' },
      { user: { userId: 'staff-1' } },
    );
    expect(mockUserBranchQueryService.getBranchIdOfUser).toHaveBeenCalledWith(
      'staff-1',
    );
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-1',
      { userId: 'staff-1', role: Role.STAFF, branchId: 'br-1' },
      'Khách đổi lịch',
    );

    mockUserBranchQueryService.getBranchIdOfUser.mockResolvedValueOnce(null);
    await controller.cancelStaffOrder(
      'ord-2',
      undefined as any,
      { user: { sub: 'staff-2' } },
    );
    expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
      'ord-2',
      { userId: 'staff-2', role: Role.STAFF, branchId: undefined },
      undefined,
    );
  });
});
