import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { Role } from '../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../auth/infra/guards/role.guard';
import { StatisticsController } from './statistics.controller';
import { FinancialStatisticsResDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: jest.Mocked<Pick<StatisticsService, 'getFinancial'>>;

  beforeEach(async () => {
    service = { getFinancial: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [{ provide: StatisticsService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StatisticsController);
  });

  it('getFinancial delegates to statisticsService.getFinancial', async () => {
    const user: AuthenticatedUser = {
      userId: 'admin-1',
      email: 'admin@test.com',
      role: Role.ADMIN,
    };
    const query = {
      date: '2026-11-01',
      period: 'day' as const,
      branchId: 'b-1',
    };
    const expected = {
      totalTicketRevenue: 100000,
    } as FinancialStatisticsResDto;
    service.getFinancial.mockResolvedValue(expected);

    const res = await controller.getFinancial(user, query);
    expect(service.getFinancial).toHaveBeenCalledWith(user, query);
    expect(res).toBe(expected);
  });
});
