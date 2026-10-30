import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  WorkSchedule,
  WorkScheduleDocument,
} from '../domain/schemas/work-schedule.schema';
import {
  Branch,
  BranchDocument,
} from '../../branch/domain/schemas/branch.schema';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import {
  ShiftAttendance,
  ShiftAttendanceDocument,
  ShiftAttendanceStatus,
} from '../domain/schemas/shift-attendance.schema';
import { Order, OrderDocument } from '../../order/domain/schemas/order.schema';
import {
  SeatOrder,
  SeatOrderDocument,
} from '../../order/domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderDocument,
} from '../../order/domain/schemas/product-order.schema';
import { OrderStatus } from '../../order/domain/enums/order-status.enum';
import {
  ShiftAssignment,
  ShiftAssignmentDocument,
} from '../domain/schemas/shift-assignment.schema';
import {
  WorkScheduleRes,
  ShiftAssignmentRes,
  ShiftAttendanceRes,
} from './dto/res.dto';
import ExcelJS from 'exceljs';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectModel(WorkSchedule.name)
    private readonly scheduleModel: Model<WorkScheduleDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ShiftAssignment.name)
    private readonly assignmentModel: Model<ShiftAssignmentDocument>,
    @InjectModel(ShiftAttendance.name)
    private readonly attendanceModel: Model<ShiftAttendanceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrderModel: Model<ProductOrderDocument>,
  ) {}

  async create(input: CreateWorkScheduleDto): Promise<WorkScheduleRes> {
    if (!isValidObjectId(input.branchId)) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    const branch = await this.branchModel
      .findById(input.branchId)
      .select('_id')
      .lean();
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    const branchObjId = branch._id;

    const toMinutes = (value: string) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = toMinutes(input.startTime);
    const end = toMinutes(input.endTime);
    const durationInMinutes = end > start ? end - start : 1440 - start + end;
    if (durationInMinutes <= 0 || durationInMinutes > 600)
      throw new BadRequestException(
        'Ca làm phải dài hơn 0 và không quá 10 giờ',
      );
    if (
      await this.scheduleModel.exists({
        branchId: branchObjId,
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
      })
    )
      throw new ConflictException('Ca làm đã tồn tại');

    const created = await this.scheduleModel.create({
      shiftName: input.shiftName,
      startTime: input.startTime,
      endTime: input.endTime,
      note: input.note,
      branchId: branchObjId,
      durationInMinutes,
      isOvernight: end <= start,
      userIds: [],
    });
    return this.mapSchedule(created.toObject());
  }

  async list(branchId?: string): Promise<WorkScheduleRes[]> {
    let filter: Record<string, unknown> = {};
    if (branchId) {
      if (!isValidObjectId(branchId)) return [];
      filter = { branchId: new Types.ObjectId(branchId) };
    }
    const docs = await this.scheduleModel
      .find(filter)
      .sort({ startTime: 1 })
      .lean()
      .exec();
    return docs.map((d) => this.mapSchedule(d));
  }

  async listForManager(userId: string): Promise<WorkScheduleRes[]> {
    if (!isValidObjectId(userId)) return [];
    const manager = await this.userModel
      .findOne({
        _id: new Types.ObjectId(userId),
        role: Role.BRANCHMANAGER,
      })
      .select('branchId')
      .lean();
    return this.list(manager?.branchId?.toString());
  }

  async assign(
    scheduleId: string,
    managerId: string,
    userIds: string[],
  ): Promise<WorkScheduleRes> {
    if (!isValidObjectId(managerId)) {
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    }
    const manager = await this.userModel
      .findOne({
        _id: new Types.ObjectId(managerId),
        role: Role.BRANCHMANAGER,
      })
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');

    const branchObjId = manager.branchId;
    if (!isValidObjectId(scheduleId)) {
      throw new NotFoundException('Không tìm thấy ca làm');
    }
    const schedule = await this.scheduleModel.findOne({
      _id: new Types.ObjectId(scheduleId),
      branchId: branchObjId,
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');

    const invalidUserId = userIds.find((id) => !isValidObjectId(id));
    if (invalidUserId) {
      throw new BadRequestException('Danh sách nhân viên không hợp lệ');
    }
    const userObjIds = userIds.map((id) => new Types.ObjectId(id));

    const staff = await this.userModel
      .find({
        _id: { $in: userObjIds },
        branchId: branchObjId,
        role: Role.STAFF,
        isActive: true,
      })
      .select('_id')
      .lean();

    if (staff.length !== userIds.length)
      throw new BadRequestException('Danh sách nhân viên không hợp lệ');

    schedule.userIds = staff.map((s) => s._id);
    await schedule.save();
    return this.mapSchedule(schedule.toObject());
  }

  async listStaffForManager(managerId: string) {
    if (!isValidObjectId(managerId)) {
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    }
    const manager = await this.userModel
      .findOne({
        _id: new Types.ObjectId(managerId),
        role: Role.BRANCHMANAGER,
      })
      .select('branchId')
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');

    const staff = await this.userModel
      .find({
        branchId: manager.branchId,
        role: Role.STAFF,
        isActive: true,
      })
      .select('_id email firstName lastName jobPosition employmentStatus')
      .sort({ firstName: 1 })
      .lean();

    return staff.map((s) => ({
      userId: s._id.toString(),
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      jobPosition: s.jobPosition,
      employmentStatus: s.employmentStatus,
    }));
  }

  async canDelete(scheduleId: string) {
    if (!isValidObjectId(scheduleId)) {
      throw new NotFoundException('Không tìm thấy ca làm');
    }
    const schedule = await this.scheduleModel.findById(scheduleId).lean();
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    if (schedule.userIds?.length)
      return { canDelete: false, reason: 'Ca làm đã được gán nhân viên.' };
    const schObjId = new Types.ObjectId(scheduleId);
    if (await this.assignmentModel.exists({ scheduleId: schObjId }))
      return {
        canDelete: false,
        reason: 'Ca làm đã được phân công cho nhân viên theo ngày.',
      };
    if (await this.attendanceModel.exists({ scheduleId: schObjId }))
      return { canDelete: false, reason: 'Ca làm đã có dữ liệu chấm công.' };
    return { canDelete: true };
  }

  async remove(scheduleId: string) {
    const check = await this.canDelete(scheduleId);
    if (!check.canDelete) throw new BadRequestException(check.reason);
    await this.scheduleModel.findByIdAndDelete(scheduleId);
    return { deleted: true };
  }

  async update(
    scheduleId: string,
    input: CreateWorkScheduleDto,
  ): Promise<WorkScheduleRes> {
    if (!isValidObjectId(scheduleId)) {
      throw new NotFoundException('Không tìm thấy ca làm');
    }
    const current = await this.scheduleModel.findById(scheduleId);
    if (!current) throw new NotFoundException('Không tìm thấy ca làm');

    if (!isValidObjectId(input.branchId)) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    const branch = await this.branchModel
      .findById(input.branchId)
      .select('_id')
      .lean();
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');

    const minutes = (value: string) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = minutes(input.startTime),
      end = minutes(input.endTime),
      durationInMinutes = end > start ? end - start : 1440 - start + end;
    if (durationInMinutes <= 0 || durationInMinutes > 600)
      throw new BadRequestException(
        'Ca làm phải dài hơn 0 và không quá 10 giờ',
      );

    current.shiftName = input.shiftName;
    current.startTime = input.startTime;
    current.endTime = input.endTime;
    current.note = input.note;
    current.branchId = branch._id;
    current.durationInMinutes = durationInMinutes;
    current.isOvernight = end <= start;

    await current.save();
    return this.mapSchedule(current.toObject());
  }

  async dailyAssignments(managerId: string, date: string) {
    await this.assertDate(date);
    const branchObjId = await this.managerBranch(managerId);
    const [schedules, assignments, attendance] = await Promise.all([
      this.scheduleModel
        .find({ branchId: branchObjId, isActive: true })
        .sort({ startTime: 1 })
        .lean(),
      this.assignmentModel.find({ branchId: branchObjId, date }).lean(),
      this.attendanceModel.find({ branchId: branchObjId, date }).lean(),
    ]);

    const userObjIds = [...new Set(assignments.map((x) => x.userId))];
    const users = await this.userModel
      .find({
        _id: { $in: userObjIds },
      })
      .select('_id firstName lastName email jobPosition')
      .lean();

    const usersById = new Map<
      string,
      {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        jobPosition?: string;
      }
    >();
    for (const u of users) {
      usersById.set(u._id.toString(), {
        userId: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        jobPosition: u.jobPosition,
      });
    }

    const attendanceByKey = new Map(
      attendance.map((x) => [
        `${x.scheduleId.toString()}:${x.userId.toString()}`,
        ShiftAttendanceRes.from({
          attendanceId: x._id.toString(),
          scheduleId: x.scheduleId.toString(),
          userId: x.userId.toString(),
          branchId: x.branchId?.toString(),
          date: x.date,
          checkInAt: x.checkInAt,
          checkOutAt: x.checkOutAt,
          status: x.status,
        }),
      ]),
    );

    return schedules.map((schedule) => {
      const schIdStr = schedule._id.toString();
      return {
        ...this.mapSchedule(schedule),
        assignments: assignments
          .filter((x) => x.scheduleId.toString() === schIdStr)
          .map((x) => ({
            ...ShiftAssignmentRes.from({
              assignmentId: x._id.toString(),
              scheduleId: schIdStr,
              userId: x.userId.toString(),
              date: x.date,
              branchId: x.branchId?.toString() ?? '',
            }),
            user: usersById.get(x.userId.toString()),
            attendance:
              attendanceByKey.get(`${schIdStr}:${x.userId.toString()}`) ?? null,
          })),
      };
    });
  }

  async assignDay(
    managerId: string,
    scheduleId: string,
    date: string,
    userId: string,
  ): Promise<ShiftAssignmentRes> {
    await this.assertDate(date);
    const branchObjId = await this.managerBranch(managerId);

    if (!isValidObjectId(scheduleId) || !isValidObjectId(userId)) {
      throw new BadRequestException('Thông tin không hợp lệ');
    }
    const schObjId = new Types.ObjectId(scheduleId);
    const staffObjId = new Types.ObjectId(userId);

    const [schedule, staff] = await Promise.all([
      this.scheduleModel
        .findOne({ _id: schObjId, branchId: branchObjId, isActive: true })
        .lean(),
      this.userModel
        .findOne({
          _id: staffObjId,
          branchId: branchObjId,
          role: Role.STAFF,
          isActive: true,
        })
        .lean(),
    ]);

    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    if (!staff) throw new BadRequestException('Nhân viên không hợp lệ');

    const existing = await this.assignmentModel
      .find({ userId: staffObjId, date })
      .lean();
    if (
      existing.some(
        (assignment) =>
          assignment.scheduleId.toString() === schObjId.toString(),
      )
    )
      throw new ConflictException('Nhân viên đã được phân vào ca này');

    const existingScheduleIds = existing.map((x) => x.scheduleId);
    const schedules = await this.scheduleModel
      .find({ _id: { $in: existingScheduleIds } })
      .lean();
    if (schedules.some((other) => this.overlaps(schedule, other)))
      throw new ConflictException(
        'Nhân viên đã có ca trùng giờ trong ngày này',
      );

    const created = await this.assignmentModel.create({
      scheduleId: schObjId,
      userId: staffObjId,
      date,
      branchId: branchObjId,
    });
    return ShiftAssignmentRes.from({
      assignmentId: created._id.toString(),
      scheduleId: created.scheduleId.toString(),
      userId: created.userId.toString(),
      date: created.date,
      branchId: created.branchId?.toString() ?? '',
    });
  }

  async unassignDay(
    managerId: string,
    scheduleId: string,
    date: string,
    userId: string,
  ) {
    const branchObjId = await this.managerBranch(managerId);

    if (!isValidObjectId(userId) || !isValidObjectId(scheduleId)) {
      throw new NotFoundException('Không tìm thấy phân công');
    }
    const staffObjId = new Types.ObjectId(userId);
    const schObjId = new Types.ObjectId(scheduleId);

    const result = await this.assignmentModel.deleteOne({
      scheduleId: schObjId,
      userId: staffObjId,
      date,
      branchId: branchObjId,
    });
    if (!result.deletedCount)
      throw new NotFoundException('Không tìm thấy phân công');
    return { removed: true };
  }

  async closeDayShift(managerId: string, scheduleId: string, date: string) {
    await this.assertDate(date);
    const branchObjId = await this.managerBranch(managerId);
    if (!isValidObjectId(scheduleId))
      throw new NotFoundException('Không tìm thấy ca làm');
    const schObjId = new Types.ObjectId(scheduleId);

    const assignments = await this.assignmentModel
      .find({ scheduleId: schObjId, date, branchId: branchObjId })
      .lean();
    const existing = await this.attendanceModel
      .find({ scheduleId: schObjId, date })
      .select('userId')
      .lean();

    const attended = new Set(existing.map((x) => x.userId.toString()));
    const absent = assignments
      .filter((x) => !attended.has(x.userId.toString()))
      .map((x) => ({
        scheduleId: schObjId,
        userId: x.userId,
        branchId: x.branchId,
        date,
        status: ShiftAttendanceStatus.ABSENT,
      }));
    if (absent.length)
      await this.attendanceModel.insertMany(absent, { ordered: false });
    return { absent: absent.length };
  }

  private async managerBranch(managerId: string): Promise<Types.ObjectId> {
    if (!isValidObjectId(managerId)) {
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    }
    const manager = await this.userModel
      .findOne({
        _id: new Types.ObjectId(managerId),
        role: Role.BRANCHMANAGER,
      })
      .select('branchId')
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    return manager.branchId;
  }

  private async assertDate(date: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    )
      throw new BadRequestException('Ngày không hợp lệ');
  }

  private overlaps(a: WorkSchedule, b: WorkSchedule) {
    const minutes = (x: string) =>
      Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
    const ranges = (x: WorkSchedule) => {
      const start = minutes(x.startTime),
        end = minutes(x.endTime);
      return end > start
        ? [[start, end]]
        : [
            [start, 1440],
            [0, end],
          ];
    };
    return ranges(a).some(([as, ae]) =>
      ranges(b).some(([bs, be]) => as < be && bs < ae),
    );
  }

  async exportTemplate(managerId: string) {
    const schedules = await this.listForManager(managerId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phan ca');
    sheet.addRow([
      'Mã ca (scheduleId)',
      'Tên ca',
      'Giờ bắt đầu',
      'Giờ kết thúc',
      'Email nhân viên',
    ]);
    for (const s of schedules)
      sheet.addRow([s.scheduleId, s.shiftName, s.startTime, s.endTime, '']);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 25));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importAssignments(managerId: string, buffer: Buffer) {
    const branchObjId = await this.managerBranch(managerId);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2)
      throw new BadRequestException('File Excel không có dữ liệu');
    const header = sheet.getRow(1);
    const col = (name: string) => {
      for (let i = 1; i <= header.cellCount; i++)
        if (String(header.getCell(i).value).trim().toLowerCase() === name)
          return i;
      return -1;
    };
    const scheduleCol = col('mã ca (scheduleid)');
    const emailCol = col('email nhân viên');
    if (scheduleCol < 1 || emailCol < 1)
      throw new BadRequestException(
        'Thiếu cột Mã ca (scheduleId) hoặc Email nhân viên',
      );
    const assignments = new Map<string, Set<string>>();
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const id = String(row.getCell(scheduleCol).text).trim();
      const email = String(row.getCell(emailCol).text).trim().toLowerCase();
      if (!id && !email) continue;
      if (!id || !email)
        throw new BadRequestException(`Dữ liệu chưa đầy đủ tại dòng ${i}`);
      const ids = assignments.get(id) ?? new Set<string>();
      ids.add(email);
      assignments.set(id, ids);
    }
    if (!assignments.size)
      throw new BadRequestException('File Excel không có phân công');
    const emails = [
      ...new Set([...assignments.values()].flatMap((x) => [...x])),
    ];
    const staff = await this.userModel
      .find({
        email: { $in: emails },
        branchId: branchObjId,
        role: Role.STAFF,
        isActive: true,
      })
      .select('_id email')
      .lean();
    const byEmail = new Map(staff.map((x) => [x.email.toLowerCase(), x._id]));
    const missing = emails.filter((x) => !byEmail.has(x));
    if (missing.length)
      throw new BadRequestException(
        `Nhân viên không hợp lệ: ${missing.join(', ')}`,
      );

    const scheduleIds = [...assignments.keys()];
    const invalidId = scheduleIds.find((id) => !isValidObjectId(id));
    if (invalidId) {
      throw new BadRequestException('Có mã ca không thuộc chi nhánh quản lý');
    }
    const scheduleObjIds = scheduleIds.map((id) => new Types.ObjectId(id));

    const schedules = await this.scheduleModel
      .find({
        _id: { $in: scheduleObjIds },
        branchId: branchObjId,
      })
      .select('_id')
      .lean();
    if (schedules.length !== scheduleIds.length)
      throw new BadRequestException('Có mã ca không thuộc chi nhánh quản lý');

    for (const [scheduleId, assignedEmails] of assignments)
      await this.scheduleModel.updateOne(
        { _id: new Types.ObjectId(scheduleId), branchId: branchObjId },
        { $set: { userIds: [...assignedEmails].map((x) => byEmail.get(x)!) } },
      );
    return { imported: assignments.size };
  }

  async start(userId: string, scheduleId: string): Promise<ShiftAttendanceRes> {
    if (!isValidObjectId(userId) || !isValidObjectId(scheduleId)) {
      throw new NotFoundException('Ca làm không hợp lệ');
    }
    const userObjId = new Types.ObjectId(userId);
    const schObjId = new Types.ObjectId(scheduleId);

    const date = this.vnDate();
    const activeShift = await this.attendanceModel
      .findOne({ userId: userObjId, status: ShiftAttendanceStatus.IN_PROGRESS })
      .select('scheduleId')
      .lean();
    if (activeShift) {
      throw new ConflictException(
        'Bạn đang có một ca làm việc chưa kết thúc. Vui lòng kết thúc ca hiện tại trước khi bắt đầu ca mới.',
      );
    }
    const assignment = await this.assignmentModel
      .findOne({ scheduleId: schObjId, userId: userObjId, date })
      .lean();
    const schedule = assignment
      ? await this.scheduleModel
          .findOne({ _id: schObjId, isActive: true })
          .lean()
      : null;
    if (!schedule) throw new NotFoundException('Ca làm không hợp lệ');

    const now = new Date();
    const { start, end } = this.shiftWindow(
      date,
      schedule.startTime,
      schedule.endTime,
    );
    if (now < new Date(start.getTime() - 60 * 60 * 1000)) {
      throw new BadRequestException(
        'Chưa đến giờ mở ca. Bạn chỉ có thể bắt đầu trước giờ ca tối đa 60 phút.',
      );
    }
    if (now >= end) {
      throw new BadRequestException(
        'Ca làm đã qua giờ kết thúc, không thể bắt đầu.',
      );
    }
    if (
      await this.attendanceModel.exists({
        userId: userObjId,
        scheduleId: schObjId,
        date,
      })
    )
      throw new ConflictException('Ca này đã được bắt đầu hôm nay');

    const created = await this.attendanceModel.create({
      scheduleId: schObjId,
      userId: userObjId,
      branchId: schedule.branchId,
      date,
      checkInAt: new Date(),
    });
    return ShiftAttendanceRes.from({
      attendanceId: created._id.toString(),
      scheduleId: created.scheduleId.toString(),
      userId: created.userId.toString(),
      branchId: created.branchId?.toString(),
      date: created.date,
      checkInAt: created.checkInAt,
      status: created.status,
    });
  }

  async end(userId: string): Promise<ShiftAttendanceRes> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('Không có ca đang làm');
    }
    const userObjId = new Types.ObjectId(userId);

    const row = await this.attendanceModel.findOne({
      userId: userObjId,
      status: ShiftAttendanceStatus.IN_PROGRESS,
    });
    if (!row) throw new NotFoundException('Không có ca đang làm');
    row.checkOutAt = new Date();
    row.status = ShiftAttendanceStatus.COMPLETED;
    const saved = await row.save();
    return ShiftAttendanceRes.from({
      attendanceId: saved._id.toString(),
      scheduleId: saved.scheduleId.toString(),
      userId: saved.userId.toString(),
      branchId: saved.branchId?.toString(),
      date: saved.date,
      checkInAt: saved.checkInAt,
      checkOutAt: saved.checkOutAt,
      status: saved.status,
    });
  }

  async myShifts(userId: string, requestedDate?: string) {
    const date = requestedDate ?? this.vnDate();
    await this.assertDate(date);

    if (!isValidObjectId(userId)) return [];
    const userObjId = new Types.ObjectId(userId);

    const assignments = await this.assignmentModel
      .find({ userId: userObjId, date })
      .lean();
    const schedules = await this.scheduleModel
      .find({
        _id: { $in: assignments.map((x) => x.scheduleId) },
        isActive: true,
      })
      .sort({ startTime: 1 })
      .lean();
    const attendances = await this.attendanceModel
      .find({ userId: userObjId, date })
      .lean();
    const bySchedule = new Map(
      attendances.map((x) => [
        x.scheduleId.toString(),
        ShiftAttendanceRes.from({
          attendanceId: x._id.toString(),
          scheduleId: x.scheduleId.toString(),
          userId: x.userId.toString(),
          branchId: x.branchId?.toString(),
          date: x.date,
          checkInAt: x.checkInAt,
          checkOutAt: x.checkOutAt,
          status: x.status,
        }),
      ]),
    );

    return schedules.map((schedule) => ({
      ...this.mapSchedule(schedule),
      attendance: bySchedule.get(schedule._id.toString()) ?? null,
    }));
  }

  async stats(userId: string) {
    if (!isValidObjectId(userId))
      return { revenue: 0, tickets: 0, products: 0 };
    const userObjId = new Types.ObjectId(userId);

    const a = await this.attendanceModel
      .findOne({ userId: userObjId, date: this.vnDate() })
      .sort({ checkInAt: -1 })
      .lean();
    if (!a?.checkInAt) return { revenue: 0, tickets: 0, products: 0 };
    const end = a.checkOutAt || new Date();

    const orders = await this.orderModel
      .find({
        userId: userObjId,
        status: OrderStatus.PAID,
        createdAt: { $gte: a.checkInAt, $lte: end },
      })
      .select('_id totalAmount')
      .lean();
    const ids = orders.map((x) => x._id);

    const [tickets, products] = await Promise.all([
      this.seatOrderModel.countDocuments({ orderId: { $in: ids } }),
      this.productOrderModel.aggregate([
        { $match: { orderId: { $in: ids } } },
        { $group: { _id: null, quantity: { $sum: '$quantity' } } },
      ]),
    ]);

    return {
      revenue: orders.reduce((s, x) => s + x.totalAmount, 0),
      tickets,
      products: products[0]?.quantity || 0,
      checkInAt: a.checkInAt,
      checkOutAt: a.checkOutAt,
      scheduleId: a.scheduleId.toString(),
    };
  }

  private mapSchedule(doc: any): WorkScheduleRes {
    return WorkScheduleRes.from({
      scheduleId:
        (doc._id as Types.ObjectId)?.toString() ?? String(doc.scheduleId ?? ''),
      shiftName: doc.shiftName,
      startTime: doc.startTime,
      endTime: doc.endTime,
      durationInMinutes: doc.durationInMinutes,
      isOvernight: doc.isOvernight,
      userIds: ((doc.userIds as (Types.ObjectId | string)[]) ?? []).map(
        (id) => id?.toString() ?? '',
      ),
      branchId: doc.branchId
        ? (doc.branchId as Types.ObjectId).toString()
        : undefined,
      note: doc.note,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  private vnDate(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  private shiftWindow(date: string, startTime: string, endTime: string) {
    const [year, month, day] = date.split('-').map(Number);
    const toDate = (time: string) =>
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          Number(time.slice(0, 2)),
          Number(time.slice(3)),
        ) -
          7 * 60 * 60 * 1000,
      );
    const start = toDate(startTime);
    const end = toDate(endTime);
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }
}
