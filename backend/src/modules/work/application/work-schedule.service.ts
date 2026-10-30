import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { Role, ShiftAttendanceStatus, OrderStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { VietnamTime } from '../domain/vietnam-time.helper';

@Injectable()
export class WorkScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateWorkScheduleDto) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        OR: [{ id: input.branchId }, { branchName: input.branchId }],
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    const branchId = branch.id;
    const toMinutes = (value: string) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = toMinutes(input.startTime);
    const end = toMinutes(input.endTime);
    const durationInMinutes = end > start ? end - start : 1440 - start + end;
    if (durationInMinutes <= 0 || durationInMinutes > 600)
      throw new BadRequestException(
        'Ca làm phải dài hơn 0 và không quá 10 giờ',
      );
    const existing = await this.prisma.workSchedule.findFirst({
      where: {
        branchId,
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
    if (existing) throw new ConflictException('Ca làm đã tồn tại');
    const created = await this.prisma.workSchedule.create({
      data: {
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
        isActive: input.isActive ?? true,
        branchId,
        durationInMinutes,
        isOvernight: end <= start,
        userIds: [],
      },
    });
    return {
      ...created,
      scheduleId: created.id,
    };
  }

  async list(branchId?: string) {
    const schedules = await this.prisma.workSchedule.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { startTime: 'asc' },
    });
    return schedules.map((s) => ({ ...s, scheduleId: s.id }));
  }

  async listForManager(userId: string) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: Role.MANAGER,
      },
      select: { branchId: true },
    });
    return this.list(manager?.branchId ?? undefined);
  }

  async assign(scheduleId: string, managerId: string, userIds: string[]) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId,
        role: Role.MANAGER,
      },
      select: { branchId: true },
    });
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    const schedule = await this.prisma.workSchedule.findFirst({
      where: {
        id: scheduleId,
        branchId: manager.branchId,
      },
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    const staff = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        branchId: manager.branchId,
        role: Role.STAFF,
        isActive: true,
      },
      select: { id: true },
    });
    if (staff.length !== userIds.length)
      throw new BadRequestException('Danh sách nhân viên không hợp lệ');
    const updated = await this.prisma.workSchedule.update({
      where: { id: scheduleId },
      data: { userIds },
    });
    return { ...updated, scheduleId: updated.id };
  }

  async listStaffForManager(managerId: string) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId,
        role: Role.MANAGER,
      },
      select: { branchId: true },
    });
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    const staff = await this.prisma.user.findMany({
      where: { branchId: manager.branchId, role: Role.STAFF, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        jobPosition: true,
        employmentStatus: true,
      },
      orderBy: { firstName: 'asc' },
    });
    return staff.map((s) => ({ ...s, userId: s.id }));
  }

  async canDelete(scheduleId: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    if (schedule.userIds?.length)
      return { canDelete: false, reason: 'Ca làm đã được gán nhân viên.' };
    const hasAssignments = await this.prisma.shiftAssignment.findFirst({
      where: { scheduleId },
      select: { id: true },
    });
    if (hasAssignments)
      return {
        canDelete: false,
        reason: 'Ca làm đã được phân công cho nhân viên theo ngày.',
      };
    const hasAttendance = await this.prisma.shiftAttendance.findFirst({
      where: { scheduleId },
      select: { id: true },
    });
    if (hasAttendance)
      return { canDelete: false, reason: 'Ca làm đã có dữ liệu chấm công.' };
    return { canDelete: true };
  }

  async remove(scheduleId: string) {
    const check = await this.canDelete(scheduleId);
    if (!check.canDelete) throw new BadRequestException(check.reason);
    await this.prisma.workSchedule.delete({ where: { id: scheduleId } });
    return { deleted: true };
  }

  async update(scheduleId: string, input: CreateWorkScheduleDto) {
    const current = await this.prisma.workSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!current) throw new NotFoundException('Không tìm thấy ca làm');
    const branch = await this.prisma.branch.findFirst({
      where: {
        OR: [{ id: input.branchId }, { branchName: input.branchId }],
      },
      select: { id: true },
    });
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
    const updated = await this.prisma.workSchedule.update({
      where: { id: scheduleId },
      data: {
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
        isActive: input.isActive ?? true,
        branchId: branch.id,
        durationInMinutes,
        isOvernight: end <= start,
      },
    });
    return { ...updated, scheduleId: updated.id };
  }

  async dailyAssignments(managerId: string, date: string) {
    this.assertDate(date);
    const branchId = await this.managerBranch(managerId);
    const [schedules, assignments, attendance] = await Promise.all([
      this.prisma.workSchedule.findMany({
        where: { branchId, isActive: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.shiftAssignment.findMany({
        where: { branchId, date },
      }),
      this.prisma.shiftAttendance.findMany({
        where: { branchId, date },
      }),
    ]);
    const userIds = [...new Set(assignments.map((x) => x.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobPosition: true,
      },
    });
    const usersById = new Map(users.map((x) => [x.id, { ...x, userId: x.id }]));
    const attendanceByKey = new Map(
      attendance.map((x) => [`${x.scheduleId}:${x.userId}`, x]),
    );
    return schedules.map((schedule) => ({
      ...schedule,
      scheduleId: schedule.id,
      assignments: assignments
        .filter((x) => x.scheduleId === schedule.id)
        .map((x) => ({
          ...x,
          user: usersById.get(x.userId),
          attendance:
            attendanceByKey.get(`${x.scheduleId}:${x.userId}`) ?? null,
        })),
    }));
  }
  async assignDay(
    managerId: string,
    scheduleId: string,
    date: string,
    userId: string,
  ) {
    this.assertDate(date);
    const branchId = await this.managerBranch(managerId);
    const [schedule, staff] = await Promise.all([
      this.prisma.workSchedule.findFirst({
        where: { id: scheduleId, branchId, isActive: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, branchId, role: Role.STAFF, isActive: true },
      }),
    ]);
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    if (!staff) throw new BadRequestException('Nhân viên không hợp lệ');

    // Business Rule: Cannot assign staff if the shift has already ended
    if (VietnamTime.isShiftExpired(date, schedule.startTime, schedule.endTime)) {
      throw new BadRequestException(
        'Ca làm việc này đã kết thúc, không thể phân công nhân viên.',
      );
    }

    const existing = await this.prisma.shiftAssignment.findMany({
      where: { userId, date, branchId },
    });
    if (existing.some((assignment) => assignment.scheduleId === scheduleId))
      throw new ConflictException('Nhân viên đã được phân vào ca này');
    const schedules = await this.prisma.workSchedule.findMany({
      where: { id: { in: existing.map((x) => x.scheduleId) } },
    });
    if (schedules.some((other) => this.overlaps(schedule, other)))
      throw new ConflictException(
        'Nhân viên đã có ca trùng giờ trong ngày này',
      );
    try {
      return await this.prisma.shiftAssignment.create({
        data: {
          scheduleId,
          userId,
          date,
          branchId: schedule.branchId ?? branchId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Nhân viên đã được phân vào ca này');
      }
      throw e;
    }
  }

  async unassignDay(
    managerId: string,
    scheduleId: string,
    date: string,
    userId: string,
  ) {
    const branchId = await this.managerBranch(managerId);
    const result = await this.prisma.shiftAssignment.deleteMany({
      where: { scheduleId, userId, date, branchId },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy phân công');
    return { removed: true };
  }

  async closeDayShift(managerId: string, scheduleId: string, date: string) {
    this.assertDate(date);
    const branchId = await this.managerBranch(managerId);
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { id: scheduleId, branchId, isActive: true },
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');

    // Shift cannot be closed before its scheduled end time
    if (!VietnamTime.isShiftExpired(date, schedule.startTime, schedule.endTime)) {
      throw new BadRequestException(
        'Ca làm chưa kết thúc, không thể đóng ca sớm.',
      );
    }

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { scheduleId, date, branchId },
    });
    const existing = await this.prisma.shiftAttendance.findMany({
      where: { scheduleId, date },
      select: { userId: true },
    });
    const attended = new Set(existing.map((x) => x.userId));
    const absent = assignments
      .filter((x) => !attended.has(x.userId))
      .map((x) => ({
        scheduleId,
        userId: x.userId,
        branchId: x.branchId,
        date,
        status: ShiftAttendanceStatus.ABSENT,
      }));
    if (absent.length)
      await this.prisma.shiftAttendance.createMany({
        data: absent,
      });
    return { absent: absent.length };
  }

  private async managerBranch(managerId: string) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId,
        role: Role.MANAGER,
      },
      select: { branchId: true },
    });
    if (!manager?.branchId)
      throw new NotFoundException('Manager chưa được gán chi nhánh');
    return manager.branchId;
  }

  private assertDate(date: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    )
      throw new BadRequestException('Ngày không hợp lệ');
  }

  private overlaps(
    a: { startTime: string; endTime: string },
    b: { startTime: string; endTime: string },
  ) {
    const minutes = (x: string) =>
      Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
    const ranges = (x: { startTime: string; endTime: string }) => {
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
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importAssignments(managerId: string, buffer: Buffer) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId,
        role: Role.MANAGER,
      },
      select: { branchId: true },
    });
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
        if (
          String(header.getCell(i).text || '')
            .trim()
            .toLowerCase() === name
        )
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
    const staff = await this.prisma.user.findMany({
      where: {
        email: { in: emails },
        branchId: manager.branchId,
        role: Role.STAFF,
        isActive: true,
      },
      select: { email: true, id: true },
    });
    const byEmail = new Map(staff.map((x) => [x.email.toLowerCase(), x.id]));
    const missing = emails.filter((x) => !byEmail.has(x));
    if (missing.length)
      throw new BadRequestException(
        `Nhân viên không hợp lệ: ${missing.join(', ')}`,
      );
    const scheduleIds = [...assignments.keys()];
    const schedules = await this.prisma.workSchedule.findMany({
      where: { id: { in: scheduleIds }, branchId: manager.branchId },
      select: { id: true },
    });
    if (schedules.length !== scheduleIds.length)
      throw new BadRequestException('Có mã ca không thuộc chi nhánh quản lý');
    for (const [scheduleId, assignedEmails] of assignments)
      await this.prisma.workSchedule.update({
        where: { id: scheduleId },
        data: { userIds: [...assignedEmails].map((x) => byEmail.get(x)!) },
      });
    return { imported: assignments.size };
  }

  async start(userId: string, scheduleId: string) {
    const date = this.vnDate();
    const activeShift = await this.prisma.shiftAttendance.findFirst({
      where: { userId, status: ShiftAttendanceStatus.IN_PROGRESS },
      select: { scheduleId: true },
    });
    if (activeShift) {
      throw new ConflictException(
        'Bạn đang có một ca làm việc chưa kết thúc. Vui lòng kết thúc ca hiện tại trước khi bắt đầu ca mới.',
      );
    }
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { scheduleId, userId, date },
    });
    const schedule = assignment
      ? await this.prisma.workSchedule.findFirst({
          where: { id: scheduleId, isActive: true },
        })
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
    const alreadyStarted = await this.prisma.shiftAttendance.findFirst({
      where: { userId, scheduleId, date },
    });
    if (alreadyStarted)
      throw new ConflictException('Ca này đã được bắt đầu hôm nay');
    return this.prisma.shiftAttendance.create({
      data: {
        scheduleId,
        userId,
        branchId: schedule.branchId || '',
        date,
        checkInAt: new Date(),
        status: ShiftAttendanceStatus.IN_PROGRESS,
      },
    });
  }

  async end(userId: string) {
    const row = await this.prisma.shiftAttendance.findFirst({
      where: {
        userId,
        status: ShiftAttendanceStatus.IN_PROGRESS,
      },
    });
    if (!row) throw new NotFoundException('Không có ca đang làm');
    return this.prisma.shiftAttendance.update({
      where: { id: row.id },
      data: {
        checkOutAt: new Date(),
        status: ShiftAttendanceStatus.COMPLETED,
      },
    });
  }

  async myShifts(userId: string, requestedDate?: string) {
    const date = requestedDate ?? this.vnDate();
    this.assertDate(date);
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { userId, date },
    });
    const schedules = await this.prisma.workSchedule.findMany({
      where: {
        id: { in: assignments.map((x) => x.scheduleId) },
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });
    const attendances = await this.prisma.shiftAttendance.findMany({
      where: { userId, date },
    });
    const bySchedule = new Map(attendances.map((x) => [x.scheduleId, x]));
    return schedules.map((schedule) => ({
      ...schedule,
      scheduleId: schedule.id,
      attendance: bySchedule.get(schedule.id) ?? null,
    }));
  }
  private vnDate(now = new Date()) {
    return VietnamTime.today(now);
  }
  private shiftWindow(date: string, startTime: string, endTime: string) {
    const { startAt, endAt } = VietnamTime.getShiftRange(
      date,
      startTime,
      endTime,
    );
    return { start: startAt, end: endAt };
  }

  async stats(userId: string) {
    const a = await this.prisma.shiftAttendance.findFirst({
      where: { userId, date: this.vnDate() },
      orderBy: { checkInAt: 'desc' },
    });
    if (!a?.checkInAt) return { revenue: 0, tickets: 0, products: 0 };
    const end = a.checkOutAt || new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: OrderStatus.PAID,
        createdAt: { gte: a.checkInAt, lte: end },
      },
      select: { id: true, totalAmount: true },
    });
    const ids = orders.map((x) => x.id);
    const [tickets, productAggr] = await Promise.all([
      this.prisma.seatOrder.count({ where: { orderId: { in: ids } } }),
      this.prisma.productOrder.aggregate({
        where: { orderId: { in: ids } },
        _sum: { quantity: true },
      }),
    ]);
    return {
      revenue: orders.reduce((s, x) => s + x.totalAmount, 0),
      tickets,
      products: productAggr._sum.quantity || 0,
      checkInAt: a.checkInAt,
      checkOutAt: a.checkOutAt,
      scheduleId: a.scheduleId,
    };
  }
}
