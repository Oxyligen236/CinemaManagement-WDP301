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
});
