import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WorkScheduleService } from './work-schedule.service';
import { WorkSchedule } from '../domain/schemas/work-schedule.schema';
import { Branch } from '../../branch/domain/schemas/branch.schema';
import { User } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { ShiftAssignment } from '../domain/schemas/shift-assignment.schema';
import { ShiftAttendance } from '../domain/schemas/shift-attendance.schema';
import { Order } from '../../order/domain/schemas/order.schema';
import { SeatOrder } from '../../order/domain/schemas/seat-order.schema';
import { ProductOrder } from '../../order/domain/schemas/product-order.schema';

const mockChain = (val: unknown) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(val),
  exec: jest.fn().mockResolvedValue(val),
  sort: jest.fn().mockReturnThis(),
});

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;

  const mockScheduleModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockBranchModel = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockAssignmentModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockAttendanceModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOrderModel = { find: jest.fn() };
  const mockSeatOrderModel = { find: jest.fn() };
  const mockProductOrderModel = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        {
          provide: getModelToken(WorkSchedule.name),
          useValue: mockScheduleModel,
        },
        { provide: getModelToken(Branch.name), useValue: mockBranchModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken(ShiftAssignment.name),
          useValue: mockAssignmentModel,
        },
        {
          provide: getModelToken(ShiftAttendance.name),
          useValue: mockAttendanceModel,
        },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(SeatOrder.name),
          useValue: mockSeatOrderModel,
        },
        {
          provide: getModelToken(ProductOrder.name),
          useValue: mockProductOrderModel,
        },
      ],
    }).compile();

    service = module.get<WorkScheduleService>(WorkScheduleService);
  });

  describe('create', () => {
    it('throws NotFoundException when branch not found', async () => {
      const branchId = new Types.ObjectId().toString();
      mockBranchModel.findById.mockReturnValue(mockChain(null));

      await expect(
        service.create({
          shiftName: 'Ca sáng',
          branchId,
          startTime: '08:00',
          endTime: '16:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates schedule with ObjectId successfully', async () => {
      const branchId = new Types.ObjectId();
      const schedId = new Types.ObjectId();
      mockBranchModel.findById.mockReturnValue(mockChain({ _id: branchId }));
      mockScheduleModel.exists.mockResolvedValue(null);

      const createdDoc = {
        _id: schedId,
        shiftName: 'Ca sáng',
        branchId,
        startTime: '08:00',
        endTime: '16:00',
        durationInMinutes: 480,
        isOvernight: false,
        userIds: [],
        isActive: true,
        toObject: () => ({
          _id: schedId,
          shiftName: 'Ca sáng',
          branchId,
          startTime: '08:00',
          endTime: '16:00',
          durationInMinutes: 480,
          isOvernight: false,
          userIds: [],
          isActive: true,
        }),
      };

      mockScheduleModel.create.mockResolvedValue(createdDoc);

      const res = await service.create({
        shiftName: 'Ca sáng',
        branchId: branchId.toString(),
        startTime: '08:00',
        endTime: '16:00',
      });

      expect(res.scheduleId).toBe(schedId.toString());
      expect(res.branchId).toBe(branchId.toString());
      expect(res.durationInMinutes).toBe(480);
      expect(res.isOvernight).toBe(false);
    });
  });

  describe('assign', () => {
    it('throws NotFoundException when manager has no branch', async () => {
      const managerId = new Types.ObjectId().toString();
      mockUserModel.findOne.mockReturnValue(mockChain(null));

      await expect(
        service.assign(new Types.ObjectId().toString(), managerId, [
          new Types.ObjectId().toString(),
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when schedule does not exist in branch', async () => {
      const managerId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      mockUserModel.findOne.mockReturnValue(
        mockChain({ _id: managerId, branchId }),
      );
      mockScheduleModel.findOne.mockResolvedValue(null);

      await expect(
        service.assign(new Types.ObjectId().toString(), managerId.toString(), [
          new Types.ObjectId().toString(),
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when some staff not found in branch', async () => {
      const managerId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      const schedId = new Types.ObjectId();
      const schedDoc = {
        _id: schedId,
        branchId,
        userIds: [],
        save: jest.fn(),
      };
      mockUserModel.findOne.mockReturnValue(
        mockChain({ _id: managerId, branchId }),
      );
      mockScheduleModel.findOne.mockResolvedValue(schedDoc);
      mockUserModel.find.mockReturnValue(mockChain([]));

      await expect(
        service.assign(schedId.toString(), managerId.toString(), [
          new Types.ObjectId().toString(),
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns staff user ObjectIds successfully', async () => {
      const managerId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      const schedId = new Types.ObjectId();
      const u1 = new Types.ObjectId();

      const schedDoc = {
        _id: schedId,
        shiftName: 'Ca tối',
        branchId,
        startTime: '18:00',
        endTime: '23:00',
        durationInMinutes: 300,
        isOvernight: false,
        userIds: [],
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
        toObject: function () {
          return {
            _id: this._id,
            shiftName: this.shiftName,
            branchId: this.branchId,
            startTime: this.startTime,
            endTime: this.endTime,
            durationInMinutes: this.durationInMinutes,
            isOvernight: this.isOvernight,
            userIds: this.userIds,
            isActive: this.isActive,
          };
        },
      };

      mockUserModel.findOne.mockReturnValue(
        mockChain({ _id: managerId, branchId }),
      );
      mockScheduleModel.findOne.mockResolvedValue(schedDoc);
      mockUserModel.find.mockReturnValue(mockChain([{ _id: u1 }]));

      const res = await service.assign(
        schedId.toString(),
        managerId.toString(),
        [u1.toString()],
      );

      expect(schedDoc.userIds).toEqual([u1]);
      expect(res.userIds).toEqual([u1.toString()]);
      expect(schedDoc.save).toHaveBeenCalled();
    });
  });
});
