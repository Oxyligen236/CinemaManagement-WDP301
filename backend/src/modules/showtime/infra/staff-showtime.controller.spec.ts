import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedRequest } from '../../auth/domain/auth-user';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { StaffShowtimeQueryService } from '../application/services/staff-showtime-query.service';
import { StaffShowtimeController } from './staff-showtime.controller';

describe('StaffShowtimeController', () => {
  let controller: StaffShowtimeController;
  let staffShowtimeQueryService: jest.Mocked<StaffShowtimeQueryService>;

  beforeEach(async () => {
    staffShowtimeQueryService = {
      getStaffTodayShowtimes: jest.fn(),
    } as unknown as jest.Mocked<StaffShowtimeQueryService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffShowtimeController],
      providers: [
        {
          provide: StaffShowtimeQueryService,
          useValue: staffShowtimeQueryService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StaffShowtimeController);
  });

  it('getTodayShowtimes passes authenticated staff sub to service', async () => {
    const req = { user: { sub: 'staff-1' } } as unknown as AuthenticatedRequest;
    staffShowtimeQueryService.getStaffTodayShowtimes.mockResolvedValue([]);

    await expect(controller.getTodayShowtimes(req)).resolves.toEqual([]);
    expect(
      staffShowtimeQueryService.getStaffTodayShowtimes,
    ).toHaveBeenCalledWith('staff-1');
  });
});
