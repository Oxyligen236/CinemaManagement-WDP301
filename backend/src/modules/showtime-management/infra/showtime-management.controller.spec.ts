import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Role } from '../../user/domain/enums/role.enum';
import { SaveShowtimeReqDto } from '../application/dto/req.dto';
import { ShowtimeManagementService } from '../application/services/showtime-management.service';
import { ShowtimeManagementController } from './showtime-management.controller';

describe('ShowtimeManagementController', () => {
  let controller: ShowtimeManagementController;
  let service: jest.Mocked<ShowtimeManagementService>;

  const manager: AuthenticatedUser = {
    userId: 'mgr-1',
    email: 'mgr@latte.vn',
    role: Role.BRANCHMANAGER,
  };

  beforeEach(async () => {
    service = {
      getContext: jest.fn(),
      searchMovieOptions: jest.fn(),
      listRoomOptions: jest.fn(),
      listShowtimes: jest.fn(),
      getShowtime: jest.fn(),
      createShowtime: jest.fn(),
      updateShowtime: jest.fn(),
      deleteShowtime: jest.fn(),
    } as unknown as jest.Mocked<ShowtimeManagementService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShowtimeManagementController],
      providers: [{ provide: ShowtimeManagementService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ShowtimeManagementController);
  });

  it('delegates getContext', async () => {
    const res = { branchId: 'b-1', branchName: 'CGV 1' };
    service.getContext.mockResolvedValue(res);

    await expect(controller.getContext(manager)).resolves.toEqual(res);
    expect(service.getContext).toHaveBeenCalledWith(manager);
  });

  it('delegates searchMovieOptions', async () => {
    const query = { keyword: 'Dune', page: 1, limit: 10 };
    service.searchMovieOptions.mockResolvedValue({ items: [] } as any);

    await controller.searchMovieOptions(manager, query);
    expect(service.searchMovieOptions).toHaveBeenCalledWith(manager, query);
  });

  it('delegates listRoomOptions', async () => {
    service.listRoomOptions.mockResolvedValue([]);

    await expect(controller.listRoomOptions(manager)).resolves.toEqual([]);
    expect(service.listRoomOptions).toHaveBeenCalledWith(manager);
  });

  it('delegates listShowtimes', async () => {
    const query = { page: 1, limit: 10, movieId: 'm-1' };
    service.listShowtimes.mockResolvedValue({ items: [] } as any);

    await controller.listShowtimes(manager, query);
    expect(service.listShowtimes).toHaveBeenCalledWith(manager, query);
  });

  it('delegates getShowtime', async () => {
    service.getShowtime.mockResolvedValue({ showtimeId: 'st-1' } as any);

    await expect(controller.getShowtime(manager, 'st-1')).resolves.toEqual({
      showtimeId: 'st-1',
    });
    expect(service.getShowtime).toHaveBeenCalledWith(manager, 'st-1');
  });

  it('delegates createShowtime', async () => {
    const body = {
      movieId: 'm-1',
      screeningDate: '2030-01-01',
      startTime: '09:00',
      roomId: 'r-1',
    } as SaveShowtimeReqDto;
    service.createShowtime.mockResolvedValue({ message: 'ok' } as any);

    await expect(controller.createShowtime(manager, body)).resolves.toEqual({
      message: 'ok',
    });
    expect(service.createShowtime).toHaveBeenCalledWith(manager, body);
  });

  it('delegates updateShowtime', async () => {
    const body = {
      movieId: 'm-1',
      screeningDate: '2030-01-01',
      startTime: '10:00',
      roomId: 'r-1',
    } as SaveShowtimeReqDto;
    service.updateShowtime.mockResolvedValue({ message: 'updated' } as any);

    await expect(
      controller.updateShowtime(manager, 'st-1', body),
    ).resolves.toEqual({ message: 'updated' });
    expect(service.updateShowtime).toHaveBeenCalledWith(manager, 'st-1', body);
  });

  it('delegates deleteShowtime', async () => {
    service.deleteShowtime.mockResolvedValue({ message: 'deleted' } as any);

    await expect(controller.deleteShowtime(manager, 'st-1')).resolves.toEqual({
      message: 'deleted',
    });
    expect(service.deleteShowtime).toHaveBeenCalledWith(manager, 'st-1');
  });
});
