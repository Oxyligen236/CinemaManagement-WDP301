import { Test, TestingModule } from '@nestjs/testing';
import { TicketController } from './ticket.controller';
import { OrderService } from '../../application/services/order.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { ScanTicketReq } from '../../application/dto/req.dto';
import {
  ScanTicketResultRes,
  TicketDetailRes,
} from '../../application/dto/res.dto';

describe('TicketController', () => {
  let controller: TicketController;
  let orderService: jest.Mocked<Partial<OrderService>>;
  let userBranchQueryService: jest.Mocked<Partial<UserBranchQueryService>>;

  beforeEach(async () => {
    orderService = {
      scanTicket: jest.fn(),
      getTicketDetail: jest.fn(),
    };

    userBranchQueryService = {
      getBranchIdOfUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [
        {
          provide: OrderService,
          useValue: orderService,
        },
        {
          provide: UserBranchQueryService,
          useValue: userBranchQueryService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TicketController>(TicketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('scanTicket', () => {
    it('should query branchId for STAFF role and call orderService.scanTicket', async () => {
      const dto: ScanTicketReq = { ticketCode: 'TK-123456' };
      const req = {
        user: {
          userId: 'staff-01',
          role: Role.STAFF,
        },
      };

      (userBranchQueryService.getBranchIdOfUser as jest.Mock).mockResolvedValue(
        'branch-01',
      );

      const mockResult = {
        ticketId: 't-1',
        ticketCode: 'TK-123456',
        message: 'Soát vé thành công',
      } as ScanTicketResultRes;

      (orderService.scanTicket as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.scanTicket(dto, req);

      expect(userBranchQueryService.getBranchIdOfUser).toHaveBeenCalledWith(
        'staff-01',
      );
      expect(orderService.scanTicket).toHaveBeenCalledWith(
        {
          staffId: 'staff-01',
          branchId: 'branch-01',
          role: Role.STAFF,
        },
        dto,
      );
      expect(result).toBe(mockResult);
    });

    it('should not query branchId for ADMIN role and pass undefined branchId', async () => {
      const dto: ScanTicketReq = { ticketCode: 'TK-123456' };
      const req = {
        user: {
          userId: 'admin-01',
          role: Role.ADMIN,
        },
      };

      const mockResult = {
        ticketId: 't-1',
        ticketCode: 'TK-123456',
        message: 'Soát vé thành công',
      } as ScanTicketResultRes;

      (orderService.scanTicket as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.scanTicket(dto, req);

      expect(userBranchQueryService.getBranchIdOfUser).not.toHaveBeenCalled();
      expect(orderService.scanTicket).toHaveBeenCalledWith(
        {
          staffId: 'admin-01',
          branchId: undefined,
          role: Role.ADMIN,
        },
        dto,
      );
      expect(result).toBe(mockResult);
    });

    it('should fallback to staff-default and Role.STAFF when user is empty', async () => {
      const dto: ScanTicketReq = { ticketCode: 'TK-123456' };
      const req = {};

      (userBranchQueryService.getBranchIdOfUser as jest.Mock).mockResolvedValue(
        null,
      );

      (orderService.scanTicket as jest.Mock).mockResolvedValue({} as any);

      await controller.scanTicket(dto, req);

      expect(userBranchQueryService.getBranchIdOfUser).toHaveBeenCalledWith(
        'staff-default',
      );
      expect(orderService.scanTicket).toHaveBeenCalledWith(
        {
          staffId: 'staff-default',
          branchId: undefined,
          role: Role.STAFF,
        },
        dto,
      );
    });
  });

  describe('getTicketDetail', () => {
    it('should call orderService.getTicketDetail with ticketCode', async () => {
      const mockTicket = {
        ticketId: 't-1',
        ticketCode: 'TK-123456',
        movieTitle: 'Inception',
      } as TicketDetailRes;

      (orderService.getTicketDetail as jest.Mock).mockResolvedValue(mockTicket);

      const result = await controller.getTicketDetail('TK-123456');

      expect(orderService.getTicketDetail).toHaveBeenCalledWith('TK-123456');
      expect(result).toBe(mockTicket);
    });
  });
});
