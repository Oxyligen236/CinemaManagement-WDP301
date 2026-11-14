import { BadRequestException } from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ShiftAttendanceStatus } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../auth/domain/auth-user';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Role } from '../../user/domain/enums/role.enum';
import { WorkScheduleResDto } from '../application/dto/res.dto';
import { WorkScheduleService } from '../application/work-schedule.service';
import {
  ManagerWorkScheduleController,
  ManagerWorkScheduleStaffController,
  StaffShiftController,
  WorkScheduleController,
} from './work-schedule.controller';

describe('WorkSchedule Controllers', () => {
  type MockWorkScheduleService = Record<
    | 'list'
    | 'create'
    | 'canDelete'
    | 'update'
    | 'remove'
    | 'assign'
    | 'start'
    | 'end'
    | 'myShifts'
    | 'stats'
    | 'listForManager'
    | 'dailyAssignments'
    | 'assignDay'
    | 'unassignDay'
    | 'closeDayShift'
    | 'exportTemplate'
    | 'importAssignments'
    | 'listStaffForManager',
    jest.Mock
  >;

  let adminController: WorkScheduleController;
  let staffController: StaffShiftController;
  let managerController: ManagerWorkScheduleController;
  let managerStaffController: ManagerWorkScheduleStaffController;
  let service: MockWorkScheduleService;

  const makeReq = (sub: string, role: Role): AuthenticatedRequest =>
    ({
      user: { sub, email: `${sub}@example.com`, role, tokenVersion: 0 },
    }) as AuthenticatedRequest;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
      canDelete: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assign: jest.fn(),
      start: jest.fn(),
      end: jest.fn(),
      myShifts: jest.fn(),
      stats: jest.fn(),
      listForManager: jest.fn(),
      dailyAssignments: jest.fn(),
      assignDay: jest.fn(),
      unassignDay: jest.fn(),
      closeDayShift: jest.fn(),
      exportTemplate: jest.fn(),
      importAssignments: jest.fn(),
      listStaffForManager: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        WorkScheduleController,
        StaffShiftController,
        ManagerWorkScheduleController,
        ManagerWorkScheduleStaffController,
      ],
      providers: [{ provide: WorkScheduleService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    adminController = module.get(WorkScheduleController);
    staffController = module.get(StaffShiftController);
    managerController = module.get(ManagerWorkScheduleController);
    managerStaffController = module.get(ManagerWorkScheduleStaffController);
  });

  describe('WorkScheduleController (Admin)', () => {
    const req = makeReq('admin-1', Role.ADMIN);

    it('list delegates to service.list', async () => {
      service.list.mockResolvedValue([]);
      expect(await adminController.list('branch-1')).toEqual([]);
      expect(service.list).toHaveBeenCalledWith('branch-1');
    });

    it('create delegates to service.create', async () => {
      const dto = {
        shiftName: 'Ca Sáng',
        branchId: 'branch-1',
        startTime: '08:00',
        endTime: '12:00',
      };
      const expected = { scheduleId: 'ws-1' } as WorkScheduleResDto;
      service.create.mockResolvedValue(expected);
      expect(await adminController.create(dto)).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('canDelete delegates to service.canDelete', async () => {
      service.canDelete.mockResolvedValue({ canDelete: true });
      expect(await adminController.canDelete('ws-1')).toEqual({
        canDelete: true,
      });
      expect(service.canDelete).toHaveBeenCalledWith('ws-1');
    });

    it('update delegates to service.update', async () => {
      const dto = {
        shiftName: 'Ca Chiều',
        branchId: 'branch-1',
        startTime: '13:00',
        endTime: '17:00',
      };
      const expected = { scheduleId: 'ws-1' } as WorkScheduleResDto;
      service.update.mockResolvedValue(expected);
      expect(await adminController.update('ws-1', dto)).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith('ws-1', dto);
    });

    it('remove delegates to service.remove', async () => {
      service.remove.mockResolvedValue({ deleted: true });
      expect(await adminController.remove('ws-1')).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith('ws-1');
    });

    it('assign delegates to service.assign with req.user.sub', async () => {
      const expected = { scheduleId: 'ws-1' } as WorkScheduleResDto;
      service.assign.mockResolvedValue(expected);
      expect(
        await adminController.assign('ws-1', { userIds: ['s-1'] }, req),
      ).toEqual(expected);
      expect(service.assign).toHaveBeenCalledWith('ws-1', 'admin-1', ['s-1']);
    });
  });

  describe('StaffShiftController', () => {
    const req = makeReq('staff-1', Role.STAFF);

    it('start delegates to service.start', async () => {
      const att = { id: 'att-1' } as Awaited<
        ReturnType<WorkScheduleService['start']>
      >;
      service.start.mockResolvedValue(att);
      expect(await staffController.start('ws-1', req)).toEqual(att);
      expect(service.start).toHaveBeenCalledWith('staff-1', 'ws-1');
    });

    it('end delegates to service.end', async () => {
      const att = {
        id: 'att-1',
        status: ShiftAttendanceStatus.COMPLETED,
      } as Awaited<ReturnType<WorkScheduleService['end']>>;
      service.end.mockResolvedValue(att);
      expect(await staffController.end(req)).toEqual(att);
      expect(service.end).toHaveBeenCalledWith('staff-1');
    });

    it('list delegates to service.myShifts', async () => {
      service.myShifts.mockResolvedValue([]);
      expect(await staffController.list('2026-11-01', req)).toEqual([]);
      expect(service.myShifts).toHaveBeenCalledWith('staff-1', '2026-11-01');
    });

    it('stats delegates to service.stats', async () => {
      const stats = { revenue: 100000, tickets: 2, products: 1 };
      service.stats.mockResolvedValue(stats);
      expect(await staffController.stats(req)).toBe(stats);
      expect(service.stats).toHaveBeenCalledWith('staff-1');
    });
  });

  describe('ManagerWorkScheduleController', () => {
    const req = makeReq('mgr-1', Role.BRANCHMANAGER);

    it('list delegates to service.listForManager', async () => {
      service.listForManager.mockResolvedValue([]);
      expect(await managerController.list(req)).toEqual([]);
      expect(service.listForManager).toHaveBeenCalledWith('mgr-1');
    });

    it('daily delegates to service.dailyAssignments', async () => {
      service.dailyAssignments.mockResolvedValue([]);
      expect(await managerController.daily('2026-11-01', req)).toEqual([]);
      expect(service.dailyAssignments).toHaveBeenCalledWith(
        'mgr-1',
        '2026-11-01',
      );
    });

    it('assignDay delegates to service.assignDay', async () => {
      const assignment = { id: 'assign-1' } as Awaited<
        ReturnType<WorkScheduleService['assignDay']>
      >;
      service.assignDay.mockResolvedValue(assignment);
      expect(
        await managerController.assignDay(
          'ws-1',
          { date: '2026-11-01', userId: 'staff-1' },
          req,
        ),
      ).toEqual(assignment);
      expect(service.assignDay).toHaveBeenCalledWith(
        'mgr-1',
        'ws-1',
        '2026-11-01',
        'staff-1',
      );
    });

    it('unassignDay delegates to service.unassignDay', async () => {
      service.unassignDay.mockResolvedValue({ removed: true });
      expect(
        await managerController.unassignDay(
          'ws-1',
          '2026-11-01',
          'staff-1',
          req,
        ),
      ).toEqual({ removed: true });
      expect(service.unassignDay).toHaveBeenCalledWith(
        'mgr-1',
        'ws-1',
        '2026-11-01',
        'staff-1',
      );
    });

    it('close delegates to service.closeDayShift', async () => {
      service.closeDayShift.mockResolvedValue({ absent: 1 });
      expect(await managerController.close('ws-1', '2026-11-01', req)).toEqual({
        absent: 1,
      });
      expect(service.closeDayShift).toHaveBeenCalledWith(
        'mgr-1',
        'ws-1',
        '2026-11-01',
      );
    });

    it('template sets xlsx headers and ends response with buffer', async () => {
      const buf = Buffer.from('excel-bytes');
      service.exportTemplate.mockResolvedValue(buf);
      const set = jest.fn();
      const end = jest.fn();
      const mockRes = { set, end } as unknown as Response;

      await managerController.template(req, mockRes);

      expect(service.exportTemplate).toHaveBeenCalledWith('mgr-1');
      expect(set).toHaveBeenCalledWith({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="work-schedule-template.xlsx"',
      });
      expect(end).toHaveBeenCalledWith(buf);
    });

    it('import throws BadRequestException when file is missing and delegates when present', async () => {
      expect(() =>
        managerController.import(
          undefined as unknown as Express.Multer.File,
          req,
        ),
      ).toThrow(new BadRequestException('Thiếu file Excel'));

      const buf = Buffer.from('xlsx');
      service.importAssignments.mockResolvedValue({ imported: 2 });
      expect(
        await managerController.import(
          { buffer: buf } as Express.Multer.File,
          req,
        ),
      ).toEqual({ imported: 2 });
      expect(service.importAssignments).toHaveBeenCalledWith('mgr-1', buf);
    });

    it('import FileInterceptor fileFilter accepts .xlsx and rejects other extensions', () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        ManagerWorkScheduleController.prototype,
        'import',
      );
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        descriptor!.value as object,
      ) as Array<
        new () => {
          multer: {
            fileFilter: (
              req: unknown,
              file: { originalname: string },
              cb: (err: Error | null, accept: boolean) => void,
            ) => void;
          };
        }
      >;
      const InterceptorCls = interceptors[0];
      const instance = new InterceptorCls();
      const fileFilter = instance.multer.fileFilter;

      const cbOk = jest.fn();
      fileFilter(null, { originalname: 'Schedule.XLSX' }, cbOk);
      expect(cbOk).toHaveBeenCalledWith(null, true);

      const cbBad = jest.fn();
      fileFilter(null, { originalname: 'schedule.csv' }, cbBad);
      expect(cbBad).toHaveBeenCalledWith(
        new BadRequestException('Chỉ chấp nhận file .xlsx'),
        false,
      );
    });

    it('assign delegates to service.assign', async () => {
      const expected = { scheduleId: 'ws-1' } as WorkScheduleResDto;
      service.assign.mockResolvedValue(expected);
      expect(
        await managerController.assign('ws-1', { userIds: ['s-1'] }, req),
      ).toEqual(expected);
      expect(service.assign).toHaveBeenCalledWith('ws-1', 'mgr-1', ['s-1']);
    });
  });

  describe('ManagerWorkScheduleStaffController', () => {
    it('list delegates to service.listStaffForManager', async () => {
      const req = makeReq('mgr-1', Role.BRANCHMANAGER);
      const staffList = [{ userId: 's-1' }] as Awaited<
        ReturnType<WorkScheduleService['listStaffForManager']>
      >;
      service.listStaffForManager.mockResolvedValue(staffList);
      expect(await managerStaffController.list(req)).toEqual(staffList);
      expect(service.listStaffForManager).toHaveBeenCalledWith('mgr-1');
    });
  });
});
