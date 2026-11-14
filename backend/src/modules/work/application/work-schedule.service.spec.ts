import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  Role,
  ShiftAttendanceStatus,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { WorkScheduleService } from './work-schedule.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  let prisma: {
    branch: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock; findMany: jest.Mock };
    workSchedule: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    shiftAssignment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    shiftAttendance: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
    };
    order: { findMany: jest.Mock };
    seatOrder: { count: jest.Mock };
    productOrder: { aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      workSchedule: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      shiftAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      shiftAttendance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      order: { findMany: jest.fn() },
      seatOrder: { count: jest.fn() },
      productOrder: { aggregate: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<WorkScheduleService>(WorkScheduleService);
  });

  describe('listForManager', () => {
    it('queries user with exact Role.MANAGER enum and retrieves schedules for the branch', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        branchId: 'branch-101',
      });
      prisma.workSchedule.findMany.mockResolvedValue([
        { id: 'ws-1', shiftName: 'Ca Sáng', branchId: 'branch-101' },
      ]);

      const result = await service.listForManager('manager-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'manager-1',
          role: Role.MANAGER,
        },
        select: { branchId: true },
      });
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith({
        where: { branchId: 'branch-101' },
        orderBy: { startTime: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'ws-1',
          shiftName: 'Ca Sáng',
          branchId: 'branch-101',
          scheduleId: 'ws-1',
        },
      ]);
    });

    it('returns empty list if manager has no branch', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findMany.mockResolvedValue([]);

      const result = await service.listForManager('unknown-id');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'unknown-id',
          role: Role.MANAGER,
        },
        select: { branchId: true },
      });
      expect(result).toEqual([]);
    });
  });

  describe('assign', () => {
    it('throws NotFoundException when manager is not found or has no branchId', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assign('ws-1', 'invalid-manager', ['staff-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when work schedule does not belong to branch', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        branchId: 'branch-101',
      });
      prisma.workSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.assign('ws-1', 'manager-1', ['staff-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when userIds contain invalid/inactive staff', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        branchId: 'branch-101',
      });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: 'branch-101',
      });
      prisma.user.findMany.mockResolvedValue([]);

      await expect(
        service.assign('ws-1', 'manager-1', ['staff-1']),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully assigns staff when all validations pass', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        branchId: 'branch-101',
      });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: 'branch-101',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-1' }]);
      prisma.workSchedule.update.mockResolvedValue({
        id: 'ws-1',
        branchId: 'branch-101',
        userIds: ['staff-1'],
      });

      const res = await service.assign('ws-1', 'manager-1', ['staff-1']);
      expect(res.userIds).toEqual(['staff-1']);
      expect(res.scheduleId).toBe('ws-1');
    });
  });

  describe('managerBranch (scoping check)', () => {
    it('throws NotFoundException if manager user record is missing branchId in assignDay', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'mgr-no-branch',
        branchId: null,
      });

      await expect(
        service.assignDay('mgr-no-branch', 'ws-1', '2026-11-01', 'staff-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on invalid date format', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'mgr-1',
        branchId: 'branch-101',
      });

      await expect(
        service.assignDay('mgr-1', 'ws-1', 'invalid-date', 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignDay - Time Restrictions & Vietnam Time', () => {
    const managerId = 'mgr-1';
    const branchId = 'branch-101';
    const scheduleId = 'ws-shift-1';
    const staffId = 'staff-1';
    const date = '2026-11-01'; // Vietnam date

    beforeEach(() => {
      prisma.user.findFirst.mockImplementation(
        ({ where }: { where: { role?: Role } }) => {
          if (where.role === Role.MANAGER) {
            return Promise.resolve({ id: managerId, branchId });
          }
          if (where.role === Role.STAFF) {
            return Promise.resolve({
              id: staffId,
              branchId,
              role: Role.STAFF,
              isActive: true,
            });
          }
          return Promise.resolve(null);
        },
      );
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.shiftAssignment.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'assign-1', ...data }),
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Shift: 09:00 - 20:00 VN Time on 2026-11-01
    // In UTC: 2026-11-01 02:00:00 to 2026-11-01 13:00:00
    const mockShift = {
      id: scheduleId,
      branchId,
      shiftName: 'Ca Ngày',
      startTime: '09:00',
      endTime: '20:00',
      isActive: true,
    };

    it('allows assigning before shift starts (08:00 VN)', async () => {
      // 08:00 VN = 01:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T01:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      const res = await service.assignDay(managerId, scheduleId, date, staffId);
      expect(res).toBeDefined();
      expect(res.userId).toBe(staffId);
    });

    it('allows assigning exactly at shift start (09:00 VN)', async () => {
      // 09:00 VN = 02:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T02:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      const res = await service.assignDay(managerId, scheduleId, date, staffId);
      expect(res).toBeDefined();
    });

    it('allows assigning while shift is in progress (10:00 VN)', async () => {
      // 10:00 VN = 03:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T03:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      const res = await service.assignDay(managerId, scheduleId, date, staffId);
      expect(res).toBeDefined();
    });

    it('allows assigning 1 second before shift ends (19:59:59 VN)', async () => {
      // 19:59:59 VN = 12:59:59 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T12:59:59Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      const res = await service.assignDay(managerId, scheduleId, date, staffId);
      expect(res).toBeDefined();
    });

    it('rejects assigning exactly at shift end (20:00:00 VN)', async () => {
      // 20:00:00 VN = 13:00:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T13:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      await expect(
        service.assignDay(managerId, scheduleId, date, staffId),
      ).rejects.toThrow(
        new BadRequestException(
          'Ca làm việc này đã kết thúc, không thể phân công nhân viên.',
        ),
      );
    });

    it('rejects assigning after shift end (21:00 VN)', async () => {
      // 21:00 VN = 14:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T14:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      await expect(
        service.assignDay(managerId, scheduleId, date, staffId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects assigning shift from previous day', async () => {
      // Current date is 2026-11-02 08:00 VN = 01:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-02T01:00:00Z'));
      prisma.workSchedule.findFirst.mockResolvedValue(mockShift);

      await expect(
        service.assignDay(managerId, scheduleId, date, staffId),
      ).rejects.toThrow(BadRequestException);
    });

    describe('Overnight Shift (22:00 -> 06:00 VN next day)', () => {
      const overnightShift = {
        id: 'ws-overnight',
        branchId,
        shiftName: 'Ca Đêm',
        startTime: '22:00',
        endTime: '06:00',
        isActive: true,
      };

      it('allows assigning overnight shift at 02:00 VN next day (in progress)', async () => {
        // Date is 2026-11-01
        // Shift runs from 2026-11-01 22:00 VN (15:00 UTC) to 2026-11-02 06:00 VN (23:00 UTC Nov 1)
        // Current: 2026-11-02 02:00 VN = 2026-11-01 19:00:00 UTC
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-11-01T19:00:00Z'));
        prisma.workSchedule.findFirst.mockResolvedValue(overnightShift);

        const res = await service.assignDay(
          managerId,
          overnightShift.id,
          date,
          staffId,
        );
        expect(res).toBeDefined();
      });

      it('rejects assigning overnight shift at 06:00:00 VN next day (expired)', async () => {
        // 2026-11-02 06:00 VN = 2026-11-01 23:00:00 UTC
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-11-01T23:00:00Z'));
        prisma.workSchedule.findFirst.mockResolvedValue(overnightShift);

        await expect(
          service.assignDay(managerId, overnightShift.id, date, staffId),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('closeDayShift - End time restrictions', () => {
    const managerId = 'mgr-1';
    const branchId = 'branch-101';
    const scheduleId = 'ws-shift-1';
    const date = '2026-11-01';

    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({ id: managerId, branchId });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: scheduleId,
        branchId,
        startTime: '09:00',
        endTime: '20:00',
        isActive: true,
      });
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      prisma.shiftAttendance.findMany.mockResolvedValue([]);
      prisma.shiftAttendance.createMany.mockResolvedValue({ count: 0 });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects closing shift before scheduled end time', async () => {
      // 19:30 VN = 12:30 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T12:30:00Z'));

      await expect(
        service.closeDayShift(managerId, scheduleId, date),
      ).rejects.toThrow(
        new BadRequestException('Ca làm chưa kết thúc, không thể đóng ca sớm.'),
      );
    });

    it('allows closing shift at or after scheduled end time', async () => {
      // 20:00 VN = 13:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T13:00:00Z'));

      const res = await service.closeDayShift(managerId, scheduleId, date);
      expect(res).toEqual({ absent: 0 });
    });

    it('throws NotFoundException when schedule does not exist', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      await expect(
        service.closeDayShift(managerId, scheduleId, date),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates ABSENT records for assigned staff without attendance', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T13:30:00Z'));
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { scheduleId, userId: 'staff-1', branchId, date },
        { scheduleId, userId: 'staff-2', branchId, date },
      ]);
      prisma.shiftAttendance.findMany.mockResolvedValue([
        { userId: 'staff-1' },
      ]);

      const res = await service.closeDayShift(managerId, scheduleId, date);

      expect(prisma.shiftAttendance.createMany).toHaveBeenCalledWith({
        data: [
          {
            scheduleId,
            userId: 'staff-2',
            branchId,
            date,
            status: ShiftAttendanceStatus.ABSENT,
          },
        ],
      });
      expect(res).toEqual({ absent: 1 });
    });
  });

  describe('create', () => {
    it('throws NotFoundException when branch is not found', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.create({
          shiftName: 'Ca Sáng',
          branchId: 'missing',
          startTime: '08:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when shift duration exceeds 600 minutes or equals 24h', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

      await expect(
        service.create({
          shiftName: 'Ca Quá Dài',
          branchId: 'b-1',
          startTime: '08:00',
          endTime: '19:00',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          shiftName: 'Ca 0h',
          branchId: 'b-1',
          startTime: '08:00',
          endTime: '08:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when duplicate shift exists in branch', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
      prisma.workSchedule.findFirst.mockResolvedValue({ id: 'ws-dup' });

      await expect(
        service.create({
          shiftName: 'Ca Sáng',
          branchId: 'b-1',
          startTime: '08:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates daytime and overnight shifts properly', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.workSchedule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'ws-new', ...data }),
      );

      const dayShift = await service.create({
        shiftName: 'Ca Sáng',
        branchId: 'b-1',
        startTime: '08:00',
        endTime: '12:00',
      });
      expect(dayShift.scheduleId).toBe('ws-new');
      expect(dayShift.durationInMinutes).toBe(240);
      expect(dayShift.isOvernight).toBe(false);
      expect(dayShift.isActive).toBe(true);

      const nightShift = await service.create({
        shiftName: 'Ca Đêm',
        branchId: 'b-1',
        startTime: '22:00',
        endTime: '06:00',
        isActive: false,
      });
      expect(nightShift.durationInMinutes).toBe(480);
      expect(nightShift.isOvernight).toBe(true);
      expect(nightShift.isActive).toBe(false);
    });
  });

  describe('list', () => {
    it('lists all schedules when branchId is omitted and filters when provided', async () => {
      prisma.workSchedule.findMany.mockResolvedValue([
        { id: 'ws-1', shiftName: 'Ca 1' },
      ]);

      const all = await service.list();
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startTime: 'asc' },
      });
      expect(all[0].scheduleId).toBe('ws-1');

      await service.list('b-1');
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith({
        where: { branchId: 'b-1' },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('listStaffForManager', () => {
    it('throws NotFoundException when manager has no branch', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.listStaffForManager('mgr-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns active staff list for manager branch', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'staff-1',
          email: 's1@example.com',
          firstName: 'An',
          lastName: 'Nguyen',
          jobPosition: 'TICKET_SELLER',
          employmentStatus: 'ACTIVE',
        },
      ]);

      const res = await service.listStaffForManager('mgr-1');
      expect(res).toEqual([
        {
          id: 'staff-1',
          userId: 'staff-1',
          email: 's1@example.com',
          firstName: 'An',
          lastName: 'Nguyen',
          jobPosition: 'TICKET_SELLER',
          employmentStatus: 'ACTIVE',
        },
      ]);
    });
  });

  describe('canDelete & remove', () => {
    it('throws NotFoundException when schedule does not exist', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(null);
      await expect(service.canDelete('ws-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns false when schedule has assigned userIds, shiftAssignments, or shiftAttendances', async () => {
      prisma.workSchedule.findUnique.mockResolvedValueOnce({
        id: 'ws-1',
        userIds: ['s-1'],
      });
      expect(await service.canDelete('ws-1')).toEqual({
        canDelete: false,
        reason: 'Ca làm đã được gán nhân viên.',
      });

      prisma.workSchedule.findUnique.mockResolvedValueOnce({
        id: 'ws-1',
        userIds: [],
      });
      prisma.shiftAssignment.findFirst.mockResolvedValueOnce({ id: 'sa-1' });
      expect(await service.canDelete('ws-1')).toEqual({
        canDelete: false,
        reason: 'Ca làm đã được phân công cho nhân viên theo ngày.',
      });

      prisma.workSchedule.findUnique.mockResolvedValueOnce({
        id: 'ws-1',
        userIds: null,
      });
      prisma.shiftAssignment.findFirst.mockResolvedValueOnce(null);
      prisma.shiftAttendance.findFirst.mockResolvedValueOnce({ id: 'att-1' });
      expect(await service.canDelete('ws-1')).toEqual({
        canDelete: false,
        reason: 'Ca làm đã có dữ liệu chấm công.',
      });
    });

    it('returns true and remove deletes schedule when unused', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({
        id: 'ws-1',
        userIds: [],
      });
      prisma.shiftAssignment.findFirst.mockResolvedValue(null);
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);
      prisma.workSchedule.delete.mockResolvedValue({});

      expect(await service.remove('ws-1')).toEqual({ deleted: true });
      expect(prisma.workSchedule.delete).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
      });
    });

    it('remove throws BadRequestException when schedule cannot be deleted', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({
        id: 'ws-1',
        userIds: ['s-1'],
      });
      await expect(service.remove('ws-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when schedule or branch is missing', async () => {
      prisma.workSchedule.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update('ws-404', {
          shiftName: 'Ca',
          branchId: 'b-1',
          startTime: '08:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(NotFoundException);

      prisma.workSchedule.findUnique.mockResolvedValueOnce({ id: 'ws-1' });
      prisma.branch.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update('ws-1', {
          shiftName: 'Ca',
          branchId: 'b-404',
          startTime: '08:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when duration exceeds 600 minutes', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({ id: 'ws-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

      await expect(
        service.update('ws-1', {
          shiftName: 'Ca Dài',
          branchId: 'b-1',
          startTime: '08:00',
          endTime: '20:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates schedule for daytime and overnight cases', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({ id: 'ws-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
      prisma.workSchedule.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'ws-1', ...data }),
      );

      const res1 = await service.update('ws-1', {
        shiftName: 'Ca Chiều',
        branchId: 'b-1',
        startTime: '13:00',
        endTime: '17:00',
        isActive: false,
      });
      expect(res1.durationInMinutes).toBe(240);
      expect(res1.isOvernight).toBe(false);
      expect(res1.isActive).toBe(false);

      const res2 = await service.update('ws-1', {
        shiftName: 'Ca Đêm',
        branchId: 'b-1',
        startTime: '22:00',
        endTime: '04:00',
      });
      expect(res2.durationInMinutes).toBe(360);
      expect(res2.isOvernight).toBe(true);
      expect(res2.isActive).toBe(true);
    });
  });

  describe('dailyAssignments', () => {
    it('throws BadRequestException on invalid calendar date like 2026-13-01', async () => {
      await expect(
        service.dailyAssignments('mgr-1', '2026-13-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps schedules with assignments, users, and nullable attendance', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      prisma.workSchedule.findMany.mockResolvedValue([
        {
          id: 'ws-1',
          shiftName: 'Ca Sáng',
          startTime: '08:00',
          endTime: '12:00',
        },
      ]);
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'sa-1', scheduleId: 'ws-1', userId: 's-1', date: '2026-11-01' },
        { id: 'sa-2', scheduleId: 'ws-1', userId: 's-2', date: '2026-11-01' },
      ]);
      prisma.shiftAttendance.findMany.mockResolvedValue([
        { id: 'att-1', scheduleId: 'ws-1', userId: 's-1', status: 'COMPLETED' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 's-1',
          firstName: 'An',
          lastName: 'Nguyen',
          email: 'a@test.com',
          jobPosition: 'TICKET_SELLER',
        },
      ]);

      const res = await service.dailyAssignments('mgr-1', '2026-11-01');
      expect(res).toHaveLength(1);
      expect(res[0].scheduleId).toBe('ws-1');
      const assignments = res[0].assignments as Array<{
        user?: { userId: string };
        attendance: { id: string } | null;
      }>;
      expect(assignments[0].user?.userId).toBe('s-1');
      expect(assignments[0].attendance?.id).toBe('att-1');
      expect(assignments[1].attendance).toBeNull();
    });
  });

  describe('assignDay - missing entities, overlaps, and P2002', () => {
    const managerId = 'mgr-1';
    const branchId = 'branch-1';
    const date = '2026-11-01';

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws NotFoundException when schedule is missing and BadRequestException when staff invalid', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ branchId })
        .mockResolvedValueOnce(null);
      prisma.workSchedule.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assignDay(managerId, 'ws-1', date, 'staff-1'),
      ).rejects.toThrow(NotFoundException);

      prisma.user.findFirst
        .mockResolvedValueOnce({ branchId })
        .mockResolvedValueOnce(null);
      prisma.workSchedule.findFirst.mockResolvedValueOnce({
        id: 'ws-1',
        branchId,
        startTime: '09:00',
        endTime: '17:00',
      });

      await expect(
        service.assignDay(managerId, 'ws-1', date, 'staff-invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when staff already assigned to same shift or overlapping shift', async () => {
      prisma.user.findFirst.mockImplementation(
        ({ where }: { where: { role?: Role } }) =>
          Promise.resolve(
            where.role === Role.MANAGER
              ? { branchId }
              : { id: 'staff-1', branchId, role: Role.STAFF, isActive: true },
          ),
      );
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: null,
        startTime: '09:00',
        endTime: '15:00',
      });

      prisma.shiftAssignment.findMany.mockResolvedValueOnce([
        { scheduleId: 'ws-1' },
      ]);
      await expect(
        service.assignDay(managerId, 'ws-1', date, 'staff-1'),
      ).rejects.toThrow(ConflictException);

      prisma.shiftAssignment.findMany.mockResolvedValueOnce([
        { scheduleId: 'ws-other' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValueOnce([
        { id: 'ws-other', startTime: '22:00', endTime: '10:00' },
      ]);
      await expect(
        service.assignDay(managerId, 'ws-1', date, 'staff-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('allows non-overlapping shifts, maps P2002 to ConflictException, and rethrows other errors', async () => {
      prisma.user.findFirst.mockImplementation(
        ({ where }: { where: { role?: Role } }) =>
          Promise.resolve(
            where.role === Role.MANAGER
              ? { branchId }
              : { id: 'staff-1', branchId, role: Role.STAFF, isActive: true },
          ),
      );
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-2',
        branchId: null,
        startTime: '14:00',
        endTime: '18:00',
      });
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { scheduleId: 'ws-1' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValue([
        { id: 'ws-1', startTime: '08:00', endTime: '12:00' },
      ]);

      prisma.shiftAssignment.create.mockResolvedValueOnce({ id: 'sa-new' });
      const ok = await service.assignDay(managerId, 'ws-2', date, 'staff-1');
      expect(ok).toEqual({ id: 'sa-new' });

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.shiftAssignment.create.mockRejectedValueOnce(p2002);
      await expect(
        service.assignDay(managerId, 'ws-2', date, 'staff-1'),
      ).rejects.toThrow(ConflictException);

      prisma.shiftAssignment.create.mockRejectedValueOnce(
        new Error('DB crash'),
      );
      await expect(
        service.assignDay(managerId, 'ws-2', date, 'staff-1'),
      ).rejects.toThrow('DB crash');
    });
  });

  describe('unassignDay', () => {
    it('throws NotFoundException when assignment is not found', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.unassignDay('mgr-1', 'ws-1', '2026-11-01', 's-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes assignment and returns removed: true', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 1 });

      expect(
        await service.unassignDay('mgr-1', 'ws-1', '2026-11-01', 's-1'),
      ).toEqual({ removed: true });
    });
  });

  describe('exportTemplate', () => {
    it('exports an xlsx buffer containing manager branch schedules', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      prisma.workSchedule.findMany.mockResolvedValue([
        {
          id: 'ws-1',
          shiftName: 'Ca Sáng',
          startTime: '08:00',
          endTime: '12:00',
        },
      ]);

      const buf = await service.exportTemplate('mgr-1');
      expect(Buffer.isBuffer(buf)).toBe(true);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
      const sheet = wb.getWorksheet('Phan ca')!;
      expect(sheet.getRow(2).getCell(1).text).toBe('ws-1');
      expect(sheet.getRow(2).getCell(2).text).toBe('Ca Sáng');
    });
  });

  describe('importAssignments', () => {
    const buildBuffer = async (rows: unknown[][]) => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Phan ca');
      rows.forEach((r) => ws.addRow(r));
      return Buffer.from(await wb.xlsx.writeBuffer());
    };

    it('throws NotFoundException when manager has no branch', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.importAssignments('mgr-1', Buffer.alloc(0)),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when sheet has < 2 rows or missing required headers', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });

      const emptySheetBuf = await buildBuffer([['Mã ca (scheduleId)']]);
      await expect(
        service.importAssignments('mgr-1', emptySheetBuf),
      ).rejects.toThrow(BadRequestException);

      const badHeaderBuf = await buildBuffer([
        ['Col A', 'Col B'],
        ['ws-1', 'a@b.com'],
      ]);
      await expect(
        service.importAssignments('mgr-1', badHeaderBuf),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for incomplete row or empty assignments', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });

      const incompleteBuf = await buildBuffer([
        ['Mã ca (scheduleId)', 'Email nhân viên'],
        ['ws-1', ''],
      ]);
      await expect(
        service.importAssignments('mgr-1', incompleteBuf),
      ).rejects.toThrow(BadRequestException);

      const onlyBlankBuf = await buildBuffer([
        ['Mã ca (scheduleId)', 'Email nhân viên'],
        [null, null],
      ]);
      await expect(
        service.importAssignments('mgr-1', onlyBlankBuf),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when staff emails or scheduleIds are invalid', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      const buf = await buildBuffer([
        ['Mã ca (scheduleId)', 'Email nhân viên'],
        ['ws-1', 'missing@test.com'],
      ]);

      prisma.user.findMany.mockResolvedValueOnce([]);
      await expect(service.importAssignments('mgr-1', buf)).rejects.toThrow(
        BadRequestException,
      );

      prisma.user.findMany.mockResolvedValueOnce([
        { id: 's-1', email: 'missing@test.com' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValueOnce([]);
      await expect(service.importAssignments('mgr-1', buf)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('imports valid assignments and deduplicates emails per schedule', async () => {
      prisma.user.findFirst.mockResolvedValue({ branchId: 'b-1' });
      const buf = await buildBuffer([
        ['', 'Mã ca (scheduleId)', 'Tên ca', 'Email nhân viên'],
        [null, null, null, null],
        ['', 'ws-1', 'Ca Sáng', 'S1@TEST.COM'],
        ['', 'ws-1', 'Ca Sáng', 's1@test.com'],
        ['', 'ws-1', 'Ca Sáng', 's2@test.com'],
      ]);

      prisma.user.findMany.mockResolvedValue([
        { id: 'staff-1', email: 's1@test.com' },
        { id: 'staff-2', email: 's2@test.com' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValue([{ id: 'ws-1' }]);
      prisma.workSchedule.update.mockResolvedValue({});

      const res = await service.importAssignments('mgr-1', buf);

      expect(prisma.workSchedule.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { userIds: ['staff-1', 'staff-2'] },
      });
      expect(res).toEqual({ imported: 1 });
    });
  });

  describe('start', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws ConflictException when staff already has an IN_PROGRESS shift', async () => {
      prisma.shiftAttendance.findFirst.mockResolvedValue({
        scheduleId: 'ws-active',
      });
      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when assignment or active schedule is missing', async () => {
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);
      prisma.shiftAssignment.findFirst.mockResolvedValueOnce(null);

      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );

      prisma.shiftAssignment.findFirst.mockResolvedValueOnce({ id: 'sa-1' });
      prisma.workSchedule.findFirst.mockResolvedValueOnce(null);

      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when starting too early (>60m) or after shift end', async () => {
      jest.useFakeTimers();
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);
      prisma.shiftAssignment.findFirst.mockResolvedValue({ id: 'sa-1' });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: 'b-1',
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      });

      // 07:59 VN = 00:59 UTC (61 min before 09:00 VN)
      jest.setSystemTime(new Date('2026-11-01T00:59:00Z'));
      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        BadRequestException,
      );

      // 17:00 VN = 10:00 UTC (at shift end)
      jest.setSystemTime(new Date('2026-11-01T10:00:00Z'));
      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when shift was already started today', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T01:30:00Z')); // 08:30 VN
      prisma.shiftAttendance.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'att-done' });
      prisma.shiftAssignment.findFirst.mockResolvedValue({ id: 'sa-1' });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: 'b-1',
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      });

      await expect(service.start('staff-1', 'ws-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates IN_PROGRESS attendance within allowed window', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T01:30:00Z')); // 08:30 VN
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);
      prisma.shiftAssignment.findFirst.mockResolvedValue({ id: 'sa-1' });
      prisma.workSchedule.findFirst.mockResolvedValue({
        id: 'ws-1',
        branchId: null,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      });
      prisma.shiftAttendance.create.mockResolvedValue({ id: 'att-new' });

      const res = await service.start('staff-1', 'ws-1');
      expect(prisma.shiftAttendance.create).toHaveBeenCalledWith({
        data: {
          scheduleId: 'ws-1',
          userId: 'staff-1',
          branchId: '',
          date: '2026-11-01',
          checkInAt: new Date('2026-11-01T01:30:00Z'),
          status: ShiftAttendanceStatus.IN_PROGRESS,
        },
      });
      expect(res).toEqual({ id: 'att-new' });
    });
  });

  describe('end', () => {
    it('throws NotFoundException when no shift is IN_PROGRESS', async () => {
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);
      await expect(service.end('staff-1')).rejects.toThrow(NotFoundException);
    });

    it('marks active attendance COMPLETED with checkOutAt', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T10:00:00Z'));
      prisma.shiftAttendance.findFirst.mockResolvedValue({ id: 'att-1' });
      prisma.shiftAttendance.update.mockResolvedValue({
        id: 'att-1',
        status: ShiftAttendanceStatus.COMPLETED,
      });

      const res = (await service.end('staff-1')) as {
        id: string;
        status: ShiftAttendanceStatus;
      };
      expect(prisma.shiftAttendance.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: {
          checkOutAt: new Date('2026-11-01T10:00:00Z'),
          status: ShiftAttendanceStatus.COMPLETED,
        },
      });
      expect(res.status).toBe(ShiftAttendanceStatus.COMPLETED);
      jest.useRealTimers();
    });
  });

  describe('myShifts', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns assigned shifts merged with attendance or null', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T03:00:00Z'));
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { scheduleId: 'ws-1' },
        { scheduleId: 'ws-2' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValue([
        { id: 'ws-1', shiftName: 'Ca 1', startTime: '08:00', endTime: '12:00' },
        { id: 'ws-2', shiftName: 'Ca 2', startTime: '13:00', endTime: '17:00' },
      ]);
      prisma.shiftAttendance.findMany.mockResolvedValue([
        { scheduleId: 'ws-1', status: ShiftAttendanceStatus.COMPLETED },
      ]);

      const defaultDateShifts = await service.myShifts('staff-1');
      expect(prisma.shiftAssignment.findMany).toHaveBeenCalledWith({
        where: { userId: 'staff-1', date: '2026-11-01' },
      });
      expect(defaultDateShifts[0].attendance).toEqual({
        scheduleId: 'ws-1',
        status: ShiftAttendanceStatus.COMPLETED,
      });
      expect(defaultDateShifts[1].attendance).toBeNull();

      await service.myShifts('staff-1', '2026-11-05');
      expect(prisma.shiftAssignment.findMany).toHaveBeenCalledWith({
        where: { userId: 'staff-1', date: '2026-11-05' },
      });
    });
  });

  describe('stats', () => {
    it('returns zeroes when staff has no checked-in attendance today', async () => {
      prisma.shiftAttendance.findFirst.mockResolvedValue(null);

      expect(await service.stats('staff-1')).toEqual({
        revenue: 0,
        tickets: 0,
        products: 0,
      });
    });

    it('aggregates revenue, tickets, and products for completed or active attendance', async () => {
      const checkInAt = new Date('2026-11-01T01:00:00Z');
      const checkOutAt = new Date('2026-11-01T05:00:00Z');
      prisma.shiftAttendance.findFirst.mockResolvedValueOnce({
        scheduleId: 'ws-1',
        checkInAt,
        checkOutAt,
      });
      prisma.order.findMany.mockResolvedValueOnce([
        { id: 'ord-1', totalAmount: 150000 },
        { id: 'ord-2', totalAmount: 80000 },
      ]);
      prisma.seatOrder.count.mockResolvedValueOnce(3);
      prisma.productOrder.aggregate.mockResolvedValueOnce({
        _sum: { quantity: 4 },
      });

      const res = await service.stats('staff-1');
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'staff-1',
          status: OrderStatus.PAID,
          createdAt: { gte: checkInAt, lte: checkOutAt },
        },
        select: { id: true, totalAmount: true },
      });
      expect(res).toEqual({
        revenue: 230000,
        tickets: 3,
        products: 4,
        checkInAt,
        checkOutAt,
        scheduleId: 'ws-1',
      });

      // Active shift without checkOutAt and null product quantity sum
      prisma.shiftAttendance.findFirst.mockResolvedValueOnce({
        scheduleId: 'ws-2',
        checkInAt,
        checkOutAt: null,
      });
      prisma.order.findMany.mockResolvedValueOnce([]);
      prisma.seatOrder.count.mockResolvedValueOnce(0);
      prisma.productOrder.aggregate.mockResolvedValueOnce({
        _sum: { quantity: null },
      });
      const activeRes = await service.stats('staff-1');
      expect(activeRes.products).toBe(0);
      expect(activeRes.revenue).toBe(0);
    });
  });
});
