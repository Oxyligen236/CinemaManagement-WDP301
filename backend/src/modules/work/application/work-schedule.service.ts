import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSchedule, WorkScheduleDocument } from '../domain/schemas/work-schedule.schema';
import { Branch, BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { ShiftAttendance, ShiftAttendanceDocument, ShiftAttendanceStatus } from '../domain/schemas/shift-attendance.schema';
import { Order, OrderDocument } from '../../order/domain/schemas/order.schema';
import { SeatOrder, SeatOrderDocument } from '../../order/domain/schemas/seat-order.schema';
import { ProductOrder, ProductOrderDocument } from '../../order/domain/schemas/product-order.schema';
import { OrderStatus } from '../../order/domain/enums/order-status.enum';
import ExcelJS from 'exceljs';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectModel(WorkSchedule.name) private readonly scheduleModel: Model<WorkScheduleDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ShiftAttendance.name) private readonly attendanceModel: Model<ShiftAttendanceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name) private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name) private readonly productOrderModel: Model<ProductOrderDocument>,
  ) {}

  async create(input: CreateWorkScheduleDto) {
    if (!(await this.branchModel.exists({ branchId: input.branchId }))) throw new NotFoundException('Không tìm thấy chi nhánh');
    const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = toMinutes(input.startTime);
    const end = toMinutes(input.endTime);
    const durationInMinutes = end > start ? end - start : 1440 - start + end;
    if (durationInMinutes <= 0 || durationInMinutes > 600) throw new BadRequestException('Ca làm phải dài hơn 0 và không quá 10 giờ');
    if (await this.scheduleModel.exists({ branchId: input.branchId, shiftName: input.shiftName, startTime: input.startTime, endTime: input.endTime })) throw new ConflictException('Ca làm đã tồn tại');
    return this.scheduleModel.create({ ...input, durationInMinutes, isOvernight: end <= start, userIds: [] });
  }

  list(branchId?: string) { return this.scheduleModel.find(branchId ? { branchId } : {}).sort({ startTime: 1 }).lean().exec(); }
  async listForManager(userId: string) { const manager = await this.userModel.findOne({ userId, role: Role.BRANCHMANAGER }).select('branchId').lean(); return this.list(manager?.branchId); }

  async assign(scheduleId: string, managerId: string, userIds: string[]) {
    const manager = await this.userModel.findOne({ userId: managerId, role: Role.BRANCHMANAGER }).lean();
    if (!manager?.branchId) throw new NotFoundException('Manager chưa được gán chi nhánh');
    const schedule = await this.scheduleModel.findOne({ scheduleId, branchId: manager.branchId });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    const staff = await this.userModel.find({ userId: { $in: userIds }, branchId: manager.branchId, role: Role.STAFF, isActive: true }).select('userId').lean();
    if (staff.length !== userIds.length) throw new BadRequestException('Danh sách nhân viên không hợp lệ');
    schedule.userIds = userIds; return schedule.save();
  }
  async listStaffForManager(managerId: string) {
    const manager = await this.userModel.findOne({ userId: managerId, role: Role.BRANCHMANAGER }).select('branchId').lean();
    if (!manager?.branchId) throw new NotFoundException('Manager chưa được gán chi nhánh');
    return this.userModel.find({ branchId: manager.branchId, role: Role.STAFF, isActive: true }).select('userId email firstName lastName jobPosition employmentStatus').sort({ firstName: 1 }).lean();
  }
  async exportTemplate(managerId: string) {
    const schedules = await this.listForManager(managerId);
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Phan ca');
    sheet.addRow(['Mã ca (scheduleId)', 'Tên ca', 'Giờ bắt đầu', 'Giờ kết thúc', 'Email nhân viên']);
    for (const s of schedules) sheet.addRow([s.scheduleId, s.shiftName, s.startTime, s.endTime, '']);
    sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(c => c.width = 25);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  async importAssignments(managerId: string, buffer: Buffer) {
    const manager = await this.userModel.findOne({ userId: managerId, role: Role.BRANCHMANAGER }).select('branchId').lean();
    if (!manager?.branchId) throw new NotFoundException('Manager chưa được gán chi nhánh');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as never); const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new BadRequestException('File Excel không có dữ liệu');
    const header = sheet.getRow(1); const col = (name: string) => { for (let i = 1; i <= header.cellCount; i++) if (String(header.getCell(i).value).trim().toLowerCase() === name) return i; return -1; };
    const scheduleCol = col('mã ca (scheduleid)'); const emailCol = col('email nhân viên');
    if (scheduleCol < 1 || emailCol < 1) throw new BadRequestException('Thiếu cột Mã ca (scheduleId) hoặc Email nhân viên');
    const assignments = new Map<string, Set<string>>();
    for (let i = 2; i <= sheet.rowCount; i++) { const row = sheet.getRow(i); const id = String(row.getCell(scheduleCol).text).trim(); const email = String(row.getCell(emailCol).text).trim().toLowerCase(); if (!id && !email) continue; if (!id || !email) throw new BadRequestException(`Dữ liệu chưa đầy đủ tại dòng ${i}`); const ids = assignments.get(id) ?? new Set<string>(); ids.add(email); assignments.set(id, ids); }
    if (!assignments.size) throw new BadRequestException('File Excel không có phân công');
    const emails = [...new Set([...assignments.values()].flatMap(x => [...x]))];
    const staff = await this.userModel.find({ email: { $in: emails }, branchId: manager.branchId, role: Role.STAFF, isActive: true }).select('email userId').lean();
    const byEmail = new Map(staff.map(x => [x.email.toLowerCase(), x.userId]));
    const missing = emails.filter(x => !byEmail.has(x)); if (missing.length) throw new BadRequestException(`Nhân viên không hợp lệ: ${missing.join(', ')}`);
    const scheduleIds = [...assignments.keys()]; const schedules = await this.scheduleModel.find({ scheduleId: { $in: scheduleIds }, branchId: manager.branchId }).select('scheduleId').lean();
    if (schedules.length !== scheduleIds.length) throw new BadRequestException('Có mã ca không thuộc chi nhánh quản lý');
    for (const [scheduleId, assignedEmails] of assignments) await this.scheduleModel.updateOne({ scheduleId, branchId: manager.branchId }, { $set: { userIds: [...assignedEmails].map(x => byEmail.get(x)!) } });
    return { imported: assignments.size };
  }
  async start(userId: string, scheduleId: string) {
    const schedule = await this.scheduleModel.findOne({ scheduleId, userIds: userId, isActive: true }).lean();
    if (!schedule) throw new NotFoundException('Ca làm không hợp lệ');
    const date = new Date().toISOString().slice(0, 10);
    if (await this.attendanceModel.exists({ userId, scheduleId, date })) throw new ConflictException('Ca này đã được bắt đầu hôm nay');
    return this.attendanceModel.create({ scheduleId, userId, branchId: schedule.branchId, date, checkInAt: new Date() });
  }
  async end(userId: string) { const row = await this.attendanceModel.findOne({ userId, status: ShiftAttendanceStatus.IN_PROGRESS }); if (!row) throw new NotFoundException('Không có ca đang làm'); row.checkOutAt = new Date(); row.status = ShiftAttendanceStatus.COMPLETED; return row.save(); }
  async myShifts(userId: string) { const date = new Date().toISOString().slice(0, 10); const schedules = await this.scheduleModel.find({ userIds: userId, isActive: true }).sort({ startTime: 1 }).lean(); const attendances = await this.attendanceModel.find({ userId, date }).lean(); const bySchedule = new Map(attendances.map(x => [x.scheduleId, x])); return schedules.map(schedule => ({ ...schedule, attendance: bySchedule.get(schedule.scheduleId) ?? null })); }
  async stats(userId: string) { const a = await this.attendanceModel.findOne({ userId }).sort({ checkInAt: -1 }).lean(); if (!a?.checkInAt) return { revenue: 0, tickets: 0, products: 0 }; const end = a.checkOutAt || new Date(); const orders = await this.orderModel.find({ userId, status: OrderStatus.PAID, createdAt: { $gte: a.checkInAt, $lte: end } }).select('orderId totalAmount').lean(); const ids = orders.map(x => x.orderId); const [tickets, products] = await Promise.all([this.seatOrderModel.countDocuments({ orderId: { $in: ids } }), this.productOrderModel.aggregate([{ $match: { orderId: { $in: ids } } }, { $group: { _id: null, quantity: { $sum: '$quantity' } } }])]); return { revenue: orders.reduce((s, x) => s + x.totalAmount, 0), tickets, products: products[0]?.quantity || 0, checkInAt: a.checkInAt, checkOutAt: a.checkOutAt, scheduleId: a.scheduleId }; }
}
