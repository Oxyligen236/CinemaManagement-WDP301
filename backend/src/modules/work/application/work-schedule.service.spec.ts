import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
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
      prisma.user.findFirst.mockImplementation(({ where }) => {
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
      });
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
  });
});
