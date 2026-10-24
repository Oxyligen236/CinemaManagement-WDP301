import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import { ROLES_KEY, Role } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { ManagedShowtimeService } from '../application/services/managed-showtime.service';
import { ShowtimeFormOptionService } from '../application/services/showtime-form-option.service';
import { ManagedShowtimeController } from './managed-showtime.controller';

const MOCK_MANAGER: AuthenticatedUser = {
  userId: 'mgr-a',
  email: 'mgr@cinema.local',
  role: Role.MANAGER,
};
const MOCK_ADMIN: AuthenticatedUser = {
  userId: 'admin-1',
  email: 'admin@cinema.local',
  role: Role.ADMIN,
};
const MOCK_STAFF: AuthenticatedUser = {
  userId: 'staff-1',
  email: 'staff@cinema.local',
  role: Role.STAFF,
};
const MOCK_USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'user@cinema.local',
  role: Role.USER,
};
const USERS: Record<string, AuthenticatedUser> = {
  manager: MOCK_MANAGER,
  admin: MOCK_ADMIN,
  staff: MOCK_STAFF,
  user: MOCK_USER,
};

const VALID_BODY = {
  movieId: 'm-1',
  screeningDate: '2026-10-25',
  startTime: '09:30',
  roomId: 'r-1',
};

const argOf = (fn: jest.Mock, call: number, arg: number): unknown =>
  (fn.mock.calls as unknown[][])[call][arg];

describe('ManagedShowtimeController', () => {
  describe('metadata', () => {
    const proto = ManagedShowtimeController.prototype as unknown as Record<
      string,
      unknown
    >;

    it('class có JwtGuard, RoleGuard, @Roles(MANAGER), path manager/showtimes', () => {
      expect(
        Reflect.getMetadata('__guards__', ManagedShowtimeController),
      ).toEqual([JwtGuard, RoleGuard]);
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        ManagedShowtimeController,
      ) as Role[];
      expect(roles).toEqual([Role.MANAGER]);
      for (const other of [Role.ADMIN, Role.STAFF, Role.USER]) {
        expect(roles).not.toContain(other);
      }
      expect(Reflect.getMetadata('path', ManagedShowtimeController)).toBe(
        'manager/showtimes',
      );
    });

    it('context và options/* được khai báo trước :id', () => {
      const names = Object.getOwnPropertyNames(
        ManagedShowtimeController.prototype,
      );
      for (const first of [
        'getContext',
        'searchMovieOptions',
        'listRoomOptions',
      ]) {
        for (const param of ['detail', 'update', 'remove']) {
          expect(names.indexOf(first)).toBeLessThan(names.indexOf(param));
        }
      }
      expect(Reflect.getMetadata('path', proto['getContext'] as object)).toBe(
        'context',
      );
      expect(
        Reflect.getMetadata('path', proto['searchMovieOptions'] as object),
      ).toBe('options/movies');
      expect(
        Reflect.getMetadata('path', proto['listRoomOptions'] as object),
      ).toBe('options/rooms');
    });
  });

  describe('HTTP', () => {
    let app: INestApplication<App>;
    const managed = {
      listShowtimes: jest.fn(),
      getShowtime: jest.fn(),
      createShowtime: jest.fn(),
      updateShowtime: jest.fn(),
      deleteShowtime: jest.fn(),
    };
    const options = {
      getManagerContext: jest.fn(),
      searchMovieOptions: jest.fn(),
      listRoomOptions: jest.fn(),
    };

    /** JwtGuard giả: gán user từ header x-user. */
    const fakeJwtGuard: CanActivate = {
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
          user?: AuthenticatedUser;
        }>();
        const who = req.headers['x-user'];
        if (who && USERS[who]) req.user = USERS[who];
        return true;
      },
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      managed.listShowtimes.mockResolvedValue({ items: [], total: 0 });
      managed.getShowtime.mockResolvedValue({ showtimeId: 'st-1' });
      managed.createShowtime.mockResolvedValue({ message: 'ok' });
      managed.updateShowtime.mockResolvedValue({ message: 'ok' });
      managed.deleteShowtime.mockResolvedValue({ message: 'ok' });
      options.getManagerContext.mockResolvedValue({ branchId: 'b' });
      options.searchMovieOptions.mockResolvedValue({ items: [] });
      options.listRoomOptions.mockResolvedValue([]);

      const moduleRef = await Test.createTestingModule({
        controllers: [ManagedShowtimeController],
        providers: [
          { provide: ManagedShowtimeService, useValue: managed },
          { provide: ShowtimeFormOptionService, useValue: options },
          RoleGuard,
        ],
      })
        .overrideGuard(JwtGuard)
        .useValue(fakeJwtGuard)
        .compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it.each(['admin', 'staff', 'user'])(
      '%s -> 403 trên mọi route, không gọi service',
      async (who) => {
        const http = app.getHttpServer();
        await request(http)
          .get('/manager/showtimes')
          .set('x-user', who)
          .expect(403);
        await request(http)
          .get('/manager/showtimes/context')
          .set('x-user', who)
          .expect(403);
        await request(http)
          .post('/manager/showtimes')
          .set('x-user', who)
          .send(VALID_BODY)
          .expect(403);
        await request(http)
          .delete('/manager/showtimes/st-1')
          .set('x-user', who)
          .expect(403);
        expect(managed.listShowtimes).not.toHaveBeenCalled();
        expect(managed.createShowtime).not.toHaveBeenCalled();
        expect(options.getManagerContext).not.toHaveBeenCalled();
      },
    );

    it('không có user -> 403', async () => {
      await request(app.getHttpServer()).get('/manager/showtimes').expect(403);
    });

    it('GET context / options không bị :id nuốt và truyền userId', async () => {
      const http = app.getHttpServer();
      await request(http)
        .get('/manager/showtimes/context')
        .set('x-user', 'manager')
        .expect(200);
      expect(options.getManagerContext).toHaveBeenCalledWith('mgr-a');
      expect(managed.getShowtime).not.toHaveBeenCalled();

      await request(http)
        .get('/manager/showtimes/options/movies?keyword=dun&page=2&limit=5')
        .set('x-user', 'manager')
        .expect(200);
      expect(options.searchMovieOptions).toHaveBeenCalledWith(
        'mgr-a',
        expect.objectContaining({ keyword: 'dun', page: 2, limit: 5 }),
      );

      await request(http)
        .get('/manager/showtimes/options/rooms')
        .set('x-user', 'manager')
        .expect(200);
      expect(options.listRoomOptions).toHaveBeenCalledWith('mgr-a');
    });

    it('GET list: chuyển query, includePast "true" -> boolean', async () => {
      await request(app.getHttpServer())
        .get('/manager/showtimes?date=2026-10-25&includePast=true&limit=5')
        .set('x-user', 'manager')
        .expect(200);
      expect(managed.listShowtimes).toHaveBeenCalledWith(
        'mgr-a',
        expect.objectContaining({
          date: '2026-10-25',
          includePast: true,
          page: 1,
          limit: 5,
        }),
      );
    });

    it('GET list: date sai định dạng -> 400 errors[]', async () => {
      const res = await request(app.getHttpServer())
        .get('/manager/showtimes?date=25-10-2026')
        .set('x-user', 'manager')
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: [{ field: 'date', message: 'Screening date is invalid.' }],
      });
    });

    it('GET :id truyền userId và id', async () => {
      await request(app.getHttpServer())
        .get('/manager/showtimes/st-1')
        .set('x-user', 'manager')
        .expect(200);
      expect(managed.getShowtime).toHaveBeenCalledWith('mgr-a', 'st-1');
    });

    it('POST -> 201, loại field lạ', async () => {
      await request(app.getHttpServer())
        .post('/manager/showtimes')
        .set('x-user', 'manager')
        .send({ ...VALID_BODY, endTime: 'x', branchId: 'branch-b' })
        .expect(201);
      const body = argOf(managed.createShowtime, 0, 1) as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject(VALID_BODY);
      expect(body).not.toHaveProperty('endTime');
      expect(body).not.toHaveProperty('branchId');
    });

    it('POST thiếu trường -> 400 errors[] MSG01, không gọi service', async () => {
      const res = await request(app.getHttpServer())
        .post('/manager/showtimes')
        .set('x-user', 'manager')
        .send({
          movieId: 'm-1',
          screeningDate: '2026-10-25',
          startTime: '09:30',
        })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: [
          { field: 'roomId', message: 'The Screening room field is required.' },
        ],
      });
      expect(managed.createShowtime).not.toHaveBeenCalled();
    });

    it('PATCH -> 200 truyền userId, id, body', async () => {
      await request(app.getHttpServer())
        .patch('/manager/showtimes/st-1')
        .set('x-user', 'manager')
        .send(VALID_BODY)
        .expect(200);
      expect(managed.updateShowtime).toHaveBeenCalledWith(
        'mgr-a',
        'st-1',
        expect.objectContaining(VALID_BODY),
      );
    });

    it('DELETE -> 200 truyền userId, id', async () => {
      await request(app.getHttpServer())
        .delete('/manager/showtimes/st-1')
        .set('x-user', 'manager')
        .expect(200);
      expect(managed.deleteShowtime).toHaveBeenCalledWith('mgr-a', 'st-1');
    });
  });
});
