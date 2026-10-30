import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
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
import { ShiftAssignment, ShiftAssignmentDocument } from '../domain/schemas/shift-assignment.schema';
import ExcelJS from 'exceljs';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectModel(WorkSchedule.name)
    private readonly scheduleModel: Model<WorkScheduleDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ShiftAssignment.name) private readonly assignmentModel: Model<ShiftAssignmentDocument>,
    @InjectModel(ShiftAttendance.name)
    private readonly attendanceModel: Model<ShiftAttendanceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrderModel: Model<ProductOrderDocument>,
  ) {}

  async create(input: CreateWorkScheduleDto) {
    const branchFilter = isValidObjectId(input.branchId)
      ? { $or: [{ _id: input.branchId }, { branchId: input.branchId }] }
      : { branchId: input.branchId };
    if (!(await this.branchModel.exists(branchFilter)))
      throw new NotFoundException('Không tìm thấy chi nhánh');
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
        branchId: input.branchId,
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
      })
    )
      throw new ConflictException('Ca làm đã tồn tại');
    return this.scheduleModel.create({
      ...input,
      durationInMinutes,
      isOvernight: end <= start,
      userIds: [],
    });
  }

  list(branchId?: string) {
    return this.scheduleModel
      .find(branchId ? { branchId } : {})
      .sort({ startTime: 1 })
      .lean()
      .exec();
  }
  async listForManager(userId: string) {
    const manager = await this.userModel
      .findOne({ userId, role: Role.BRANCHMANAGER })
      .select('branchId')
      .lean();
    return this.list(manager?.branchId);
  }

  async assign(scheduleId: string, managerId: string, userIds: string[]) {
    const manager = await this.userModel
      .findOne({ userId: managerId, role: Role.BRANCHMANAGER })
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    const schedule = await this.scheduleModel.findOne({
      scheduleId,
      branchId: manager.branchId,
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    const staff = await this.userModel
      .find({
        userId: { $in: userIds },
        branchId: manager.branchId,
        role: Role.STAFF,
        isActive: true,
      })
      .select('userId')
      .lean();
    if (staff.length !== userIds.length)
      throw new BadRequestException('Danh sách nhân viên không hợp lệ');
    schedule.userIds = userIds;
    return schedule.save();
  }
  async listStaffForManager(managerId: string) {
    const manager = await this.userModel
      .findOne({ userId: managerId, role: Role.BRANCHMANAGER })
      .select('branchId')
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    return this.userModel
      .find({ branchId: manager.branchId, role: Role.STAFF, isActive: true })
      .select('userId email firstName lastName jobPosition employmentStatus')
      .sort({ firstName: 1 })
      .lean();
  }
  async dailyAssignments(managerId: string, date: string) {
    await this.assertDate(date);
    const branchId = await this.managerBranch(managerId);
    const [schedules, assignments, attendance] = await Promise.all([
      this.scheduleModel.find({ branchId, isActive: true }).sort({ startTime: 1 }).lean(),
      this.assignmentModel.find({ branchId, date }).lean(),
      this.attendanceModel.find({ branchId, date }).lean(),
    ]);
    const userIds = [...new Set(assignments.map((x) => x.userId))];
    const users = await this.userModel.find({ userId: { $in: userIds } }).select('userId firstName lastName email jobPosition').lean();
    const usersById = new Map(users.map((x) => [x.userId, x]));
    const attendanceByKey = new Map(attendance.map((x) => [`${x.scheduleId}:${x.userId}`, x]));
    return schedules.map((schedule) => ({ ...schedule, assignments: assignments.filter((x) => x.scheduleId === schedule.scheduleId).map((x) => ({ ...x, user: usersById.get(x.userId), attendance: attendanceByKey.get(`${x.scheduleId}:${x.userId}`) ?? null })) }));
  }
  async assignDay(managerId: string, scheduleId: string, date: string, userId: string) {
    await this.assertDate(date);
    const branchId = await this.managerBranch(managerId);
    const [schedule, staff] = await Promise.all([this.scheduleModel.findOne({ scheduleId, branchId, isActive: true }).lean(), this.userModel.findOne({ userId, branchId, role: Role.STAFF, isActive: true }).lean()]);
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    if (!staff) throw new BadRequestException('Nhân viên không hợp lệ');
    const existing = await this.assignmentModel.find({ userId, date, branchId }).lean();
    if (existing.some((assignment) => assignment.scheduleId === scheduleId)) throw new ConflictException('Nhân viên đã được phân vào ca này');
    const schedules = await this.scheduleModel.find({ scheduleId: { $in: existing.map((x) => x.scheduleId) } }).lean();
    if (schedules.some((other) => this.overlaps(schedule, other))) throw new ConflictException('Nhân viên đã có ca trùng giờ trong ngày này');
    return this.assignmentModel.create({ scheduleId, userId, date, branchId });
  }
  async unassignDay(managerId: string, scheduleId: string, date: string, userId: string) {
    const branchId = await this.managerBranch(managerId);
    const result = await this.assignmentModel.deleteOne({ scheduleId, userId, date, branchId });
    if (!result.deletedCount) throw new NotFoundException('Không tìm thấy phân công');
    return { removed: true };
  }
  async closeDayShift(managerId: string, scheduleId: string, date: string) {
    await this.assertDate(date); const branchId = await this.managerBranch(managerId);
    const assignments = await this.assignmentModel.find({ scheduleId, date, branchId }).lean();
    const existing = await this.attendanceModel.find({ scheduleId, date }).select('userId').lean();
    const attended = new Set(existing.map((x) => x.userId));
    const absent = assignments.filter((x) => !attended.has(x.userId)).map((x) => ({ scheduleId, userId: x.userId, branchId, date, status: ShiftAttendanceStatus.ABSENT }));
    if (absent.length) await this.attendanceModel.insertMany(absent, { ordered: false });
    return { absent: absent.length };
  }
  private async managerBranch(managerId: string) {
    const manager = await this.userModel.findOne({ userId: managerId, role: Role.BRANCHMANAGER }).select('branchId').lean();
    if (!manager?.branchId) throw new NotFoundException('Manager chưa được gán chi nhánh'); return manager.branchId;
  }
  private async assertDate(date: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new BadRequestException('Ngày không hợp lệ'); }
  private overlaps(a: WorkSchedule, b: WorkSchedule) { const minutes = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)); const ranges = (x: WorkSchedule) => { const start = minutes(x.startTime), end = minutes(x.endTime); return end > start ? [[start, end]] : [[start, 1440], [0, end]]; }; return ranges(a).some(([as, ae]) => ranges(b).some(([bs, be]) => as < be && bs < ae)); }
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
    const manager = await this.userModel
      .findOne({ userId: managerId, role: Role.BRANCHMANAGER })
      .select('branchId')
      .lean();
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
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
        branchId: manager.branchId,
        role: Role.STAFF,
        isActive: true,
      })
      .select('email userId')
      .lean();
    const byEmail = new Map(
      staff.map((x) => [x.email.toLowerCase(), x.userId]),
    );
    const missing = emails.filter((x) => !byEmail.has(x));
    if (missing.length)
      throw new BadRequestException(
        `Nhân viên không hợp lệ: ${missing.join(', ')}`,
      );
    const scheduleIds = [...assignments.keys()];
    const schedules = await this.scheduleModel
      .find({ scheduleId: { $in: scheduleIds }, branchId: manager.branchId })
      .select('scheduleId')
      .lean();
    if (schedules.length !== scheduleIds.length)
      throw new BadRequestException('Có mã ca không thuộc chi nhánh quản lý');
    for (const [scheduleId, assignedEmails] of assignments)
      await this.scheduleModel.updateOne(
        { scheduleId, branchId: manager.branchId },
        { $set: { userIds: [...assignedEmails].map((x) => byEmail.get(x)!) } },
      );
    return { imported: assignments.size };
  }
  async start(userId: string, scheduleId: string) {
    const date = this.vnDate();
    const activeShift = await this.attendanceModel
      .findOne({ userId, status: ShiftAttendanceStatus.IN_PROGRESS })
      .select('scheduleId')
      .lean();
    if (activeShift) {
      throw new ConflictException(
        'Bạn đang có một ca làm việc chưa kết thúc. Vui lòng kết thúc ca hiện tại trước khi bắt đầu ca mới.',
      );
    }
    const assignment = await this.assignmentModel.findOne({ scheduleId, userId, date }).lean();
    const schedule = assignment ? await this.scheduleModel.findOne({ scheduleId, isActive: true }).lean() : null;
    if (!schedule) throw new NotFoundException('Ca làm không hợp lệ');
    const now = new Date();
    const { start, end } = this.shiftWindow(date, schedule.startTime, schedule.endTime);
    if (now < new Date(start.getTime() - 60 * 60 * 1000)) {
      throw new BadRequestException('Chưa đến giờ mở ca. Bạn chỉ có thể bắt đầu trước giờ ca tối đa 60 phút.');
    }
    if (now >= end) {
      throw new BadRequestException('Ca làm đã qua giờ kết thúc, không thể bắt đầu.');
    }
    if (await this.attendanceModel.exists({ userId, scheduleId, date }))
      throw new ConflictException('Ca này đã được bắt đầu hôm nay');
    return this.attendanceModel.create({
      scheduleId,
      userId,
      branchId: schedule.branchId,
      date,
      checkInAt: new Date(),
    });
  }
  async end(userId: string) {
    const row = await this.attendanceModel.findOne({
      userId,
      status: ShiftAttendanceStatus.IN_PROGRESS,
    });
    if (!row) throw new NotFoundException('Không có ca đang làm');
    row.checkOutAt = new Date();
    row.status = ShiftAttendanceStatus.COMPLETED;
    return row.save();
  }
  async myShifts(userId: string, requestedDate?: string) {
    const date = requestedDate ?? this.vnDate();
    await this.assertDate(date);
    const assignments = await this.assignmentModel.find({ userId, date }).lean();
    const schedules = await this.scheduleModel.find({ scheduleId: { $in: assignments.map((x) => x.scheduleId) }, isActive: true }).sort({ startTime: 1 }).lean();
    const attendances = await this.attendanceModel
      .find({ userId, date })
      .lean();
    const bySchedule = new Map(attendances.map((x) => [x.scheduleId, x]));
    return schedules.map((schedule) => ({
      ...schedule,
      attendance: bySchedule.get(schedule.scheduleId) ?? null,
    }));
  }
  private vnDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  private shiftWindow(date: string, startTime: string, endTime: string) {
    const [year, month, day] = date.split('-').map(Number);
    const toDate = (time: string) => new Date(Date.UTC(year, month - 1, day, Number(time.slice(0, 2)), Number(time.slice(3))) - 7 * 60 * 60 * 1000);
    const start = toDate(startTime); const end = toDate(endTime);
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }
  async stats(userId: string) {
    const a = await this.attendanceModel
      .findOne({ userId, date: this.vnDate() })
      .sort({ checkInAt: -1 })
      .lean();
    if (!a?.checkInAt) return { revenue: 0, tickets: 0, products: 0 };
    const end = a.checkOutAt || new Date();
    const orders = await this.orderModel
      .find({
        userId,
        status: OrderStatus.PAID,
        createdAt: { $gte: a.checkInAt, $lte: end },
      })
      .select('orderId totalAmount')
      .lean();
    const ids = orders.map((x) => x.orderId);
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
      scheduleId: a.scheduleId,
    };
  }
}
