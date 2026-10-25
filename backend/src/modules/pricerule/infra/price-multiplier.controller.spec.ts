import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import { ROLES_KEY, Role } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { PriceRuleOptionQueryService } from '../application/services/price-rule-option-query.service';
import { PriceRuleValueService } from '../application/services/price-rule-value.service';
import {
  MSG03,
  MSG_CREATE_SUCCESS,
  MSG_DELETE_SUCCESS,
} from '../domain/constants/price-rule.constants';
import { PriceMultiplierController } from './price-multiplier.controller';

const MOCK_ADMIN: AuthenticatedUser = {
  userId: 'admin-1',
  email: 'admin@cinema.local',
  role: Role.ADMIN,
};
const MOCK_MANAGER: AuthenticatedUser = {
  userId: 'mgr-1',
  email: 'manager@cinema.local',
  role: Role.BRANCHMANAGER,
};

const T = new Date('2026-10-23T00:00:00Z');
const MOCK_PRICE_OPTIONS = [
  {
    group: 'SEAT',
    fieldKey: 'VIP',
    label: 'VIP Seat Multiplier',
    values: [
      { ruleId: 'mock-vip-15', multiplier: 1.5, updatedAt: T },
      { ruleId: 'mock-vip-17', multiplier: 1.7, updatedAt: T },
    ],
  },
  {
    group: 'SEAT',
    fieldKey: 'COUPLE',
    label: 'Couple Seat Multiplier',
    values: [],
  },
  {
    group: 'DAY',
    fieldKey: 'WEEKEND',
    label: 'Weekend Multiplier',
    values: [],
  },
  {
    group: 'DAY',
    fieldKey: 'HOLIDAY',
    label: 'Holiday Multiplier',
    values: [],
  },
];
const MUTATION = (message: string) => ({
  message,
  value: { ruleId: 'mock-vip-17', multiplier: 1.7, updatedAt: T.toISOString() },
  field: MOCK_PRICE_OPTIONS[0],
});

describe('PriceMultiplierController', () => {
  describe('metadata', () => {
    const proto = PriceMultiplierController.prototype as unknown as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      Function
    >;
    const reflector = new Reflector();

    it('class có JwtGuard, RoleGuard, @Roles(ADMIN), path price-multipliers', () => {
      expect(
        Reflect.getMetadata('__guards__', PriceMultiplierController),
      ).toEqual([JwtGuard, RoleGuard]);
      expect(Reflect.getMetadata(ROLES_KEY, PriceMultiplierController)).toEqual(
        [Role.ADMIN],
      );
      expect(Reflect.getMetadata('path', PriceMultiplierController)).toBe(
        'price-multipliers',
      );
    });

    it('GET options có @Roles(ADMIN, MANAGER) ở handler; handler ghi đè class', () => {
      expect(
        reflector.getAllAndOverride(ROLES_KEY, [
          proto['listOptions'],
          PriceMultiplierController,
        ]),
      ).toEqual([Role.ADMIN, Role.BRANCHMANAGER]);
      for (const h of ['listAll', 'create', 'update', 'remove']) {
        expect(
          reflector.getAllAndOverride(ROLES_KEY, [
            proto[h],
            PriceMultiplierController,
          ]),
        ).toEqual([Role.ADMIN]);
      }
    });

    it('HTTP method đúng và không có route PUT', () => {
      expect(Reflect.getMetadata('method', proto['listAll'])).toBe(0);
      expect(Reflect.getMetadata('method', proto['listOptions'])).toBe(0);
      expect(Reflect.getMetadata('method', proto['create'])).toBe(1);
      expect(Reflect.getMetadata('method', proto['update'])).toBe(4);
      expect(Reflect.getMetadata('method', proto['remove'])).toBe(3);
      expect(Reflect.getMetadata('path', proto['create'])).toBe(
        ':group/:fieldKey/values',
      );
      expect(Reflect.getMetadata('path', proto['update'])).toBe(
        ':group/:fieldKey/values/:ruleId',
      );
    });

    it('GET options được khai báo trước route có tham số', () => {
      const names = Object.getOwnPropertyNames(
        PriceMultiplierController.prototype,
      );
      const paramRoutes = ['create', 'update', 'remove'];
      for (const p of paramRoutes) {
        expect(names.indexOf('listOptions')).toBeLessThan(names.indexOf(p));
      }
    });
  });

  describe('HTTP', () => {
    let app: INestApplication<App>;
    const valueService = {
      createPriceValue: jest.fn(),
      updatePriceValue: jest.fn(),
      deletePriceValue: jest.fn(),
    };
    const optionService = { listPriceValues: jest.fn() };

    /** JwtGuard giả: gán user từ header x-user; không có header -> không user. */
    const fakeJwtGuard: CanActivate = {
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
          user?: AuthenticatedUser;
        }>();
        const who = req.headers['x-user'];
        if (who === 'admin') req.user = MOCK_ADMIN;
        if (who === 'manager') req.user = MOCK_MANAGER;
        return true;
      },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      optionService.listPriceValues.mockResolvedValue(MOCK_PRICE_OPTIONS);
      valueService.createPriceValue.mockResolvedValue(
        MUTATION(MSG_CREATE_SUCCESS),
      );
      valueService.updatePriceValue.mockResolvedValue(MUTATION(MSG03));
      valueService.deletePriceValue.mockResolvedValue(
        MUTATION(MSG_DELETE_SUCCESS),
      );
      const moduleRef = await Test.createTestingModule({
        controllers: [PriceMultiplierController],
        providers: [
          { provide: PriceRuleValueService, useValue: valueService },
          { provide: PriceRuleOptionQueryService, useValue: optionService },
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

    it('GET /price-multipliers: ADMIN 200, MANAGER 403', async () => {
      const ok = await request(app.getHttpServer())
        .get('/price-multipliers')
        .set('x-user', 'admin')
        .expect(200);
      expect((ok.body as unknown[]).length).toBe(4);
      await request(app.getHttpServer())
        .get('/price-multipliers')
        .set('x-user', 'manager')
        .expect(403);
      expect(optionService.listPriceValues).toHaveBeenCalledTimes(1);
    });

    it('GET /price-multipliers/options: MANAGER và ADMIN 200 (không bị route tham số nuốt)', async () => {
      for (const who of ['manager', 'admin']) {
        const res = await request(app.getHttpServer())
          .get('/price-multipliers/options')
          .set('x-user', who)
          .expect(200);
        expect(
          (res.body as { fieldKey: string }[]).map((f) => f.fieldKey),
        ).toEqual(['VIP', 'COUPLE', 'WEEKEND', 'HOLIDAY']);
      }
    });

    it('không có user -> 403 (RoleGuard) và không gọi service', async () => {
      await request(app.getHttpServer())
        .post('/price-multipliers/SEAT/VIP/values')
        .send({ multiplier: 1.7 })
        .expect(403);
      expect(valueService.createPriceValue).not.toHaveBeenCalled();
    });

    it('POST: ADMIN -> 201, chuyển chuỗi số thành số, loại trường lạ', async () => {
      const res = await request(app.getHttpServer())
        .post('/price-multipliers/SEAT/VIP/values')
        .set('x-user', 'admin')
        .send({ multiplier: '1.7', ruleId: 'bị loại' })
        .expect(201);
      expect((res.body as { message: string }).message).toBe(
        MSG_CREATE_SUCCESS,
      );
      expect(valueService.createPriceValue).toHaveBeenCalledWith(
        'SEAT',
        'VIP',
        {
          multiplier: 1.7,
        },
      );
    });

    it('POST: MANAGER -> 403', async () => {
      await request(app.getHttpServer())
        .post('/price-multipliers/SEAT/VIP/values')
        .set('x-user', 'manager')
        .send({ multiplier: 1.7 })
        .expect(403);
      expect(valueService.createPriceValue).not.toHaveBeenCalled();
    });

    it('POST: thiếu multiplier -> 400 errors[] MSG02, không gọi service', async () => {
      const res = await request(app.getHttpServer())
        .post('/price-multipliers/SEAT/VIP/values')
        .set('x-user', 'admin')
        .send({})
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: [
          { field: 'multiplier', message: 'The Multiplier field is required.' },
        ],
      });
      expect(valueService.createPriceValue).not.toHaveBeenCalled();
    });

    it('POST: multiplier sai -> 400 AF-2; group sai -> 400', async () => {
      const bad = await request(app.getHttpServer())
        .post('/price-multipliers/SEAT/VIP/values')
        .set('x-user', 'admin')
        .send({ multiplier: 0.8 })
        .expect(400);
      expect(
        (bad.body as { errors: { message: string }[] }).errors[0].message,
      ).toBe('Multiplier value must be a valid positive number.');
      const group = await request(app.getHttpServer())
        .post('/price-multipliers/FOO/VIP/values')
        .set('x-user', 'admin')
        .send({ multiplier: 1.7 })
        .expect(400);
      expect(
        (group.body as { errors: { field: string }[] }).errors[0].field,
      ).toBe('group');
      expect(valueService.createPriceValue).not.toHaveBeenCalled();
    });

    it('PATCH: ADMIN -> 200, truyền đúng tham số', async () => {
      const res = await request(app.getHttpServer())
        .patch('/price-multipliers/DAY/WEEKEND/values/rule-1')
        .set('x-user', 'admin')
        .send({ multiplier: 1.8 })
        .expect(200);
      expect((res.body as { message: string }).message).toBe(MSG03);
      expect(valueService.updatePriceValue).toHaveBeenCalledWith(
        'DAY',
        'WEEKEND',
        'rule-1',
        { multiplier: 1.8 },
      );
    });

    it('PATCH: MANAGER -> 403', async () => {
      await request(app.getHttpServer())
        .patch('/price-multipliers/DAY/WEEKEND/values/rule-1')
        .set('x-user', 'manager')
        .send({ multiplier: 1.8 })
        .expect(403);
      expect(valueService.updatePriceValue).not.toHaveBeenCalled();
    });

    it('DELETE: ADMIN -> 200; MANAGER -> 403', async () => {
      const res = await request(app.getHttpServer())
        .delete('/price-multipliers/SEAT/VIP/values/rule-1')
        .set('x-user', 'admin')
        .expect(200);
      expect((res.body as { message: string }).message).toBe(
        MSG_DELETE_SUCCESS,
      );
      expect(valueService.deletePriceValue).toHaveBeenCalledWith(
        'SEAT',
        'VIP',
        'rule-1',
      );
      await request(app.getHttpServer())
        .delete('/price-multipliers/SEAT/VIP/values/rule-1')
        .set('x-user', 'manager')
        .expect(403);
      expect(valueService.deletePriceValue).toHaveBeenCalledTimes(1);
    });

    it('PUT /price-multipliers/... không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .put('/price-multipliers/SEAT/VIP/default')
        .set('x-user', 'admin')
        .send({})
        .expect(404);
    });
  });
});
