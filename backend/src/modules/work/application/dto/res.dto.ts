export class WorkScheduleRes {
  _id!: string;
  scheduleId!: string;
  shiftName!: string;
  startTime!: string;
  endTime!: string;
  durationInMinutes!: number;
  isOvernight!: boolean;
  userIds!: string[];
  branchId?: string;
  note?: string;
  isActive!: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  static from(params: {
    scheduleId: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    durationInMinutes: number;
    isOvernight: boolean;
    userIds: string[];
    branchId?: string;
    note?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): WorkScheduleRes {
    const res = new WorkScheduleRes();
    res._id = params.scheduleId;
    res.scheduleId = params.scheduleId;
    res.shiftName = params.shiftName;
    res.startTime = params.startTime;
    res.endTime = params.endTime;
    res.durationInMinutes = params.durationInMinutes;
    res.isOvernight = params.isOvernight;
    res.userIds = params.userIds;
    res.branchId = params.branchId;
    res.note = params.note;
    res.isActive = params.isActive;
    res.createdAt = params.createdAt;
    res.updatedAt = params.updatedAt;
    return res;
  }
}

export class ShiftAssignmentRes {
  _id!: string;
  assignmentId!: string;
  scheduleId!: string;
  userId!: string;
  date!: string;
  branchId!: string;
  createdAt?: Date;
  updatedAt?: Date;

  static from(params: {
    assignmentId: string;
    scheduleId: string;
    userId: string;
    date: string;
    branchId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): ShiftAssignmentRes {
    const res = new ShiftAssignmentRes();
    res._id = params.assignmentId;
    res.assignmentId = params.assignmentId;
    res.scheduleId = params.scheduleId;
    res.userId = params.userId;
    res.date = params.date;
    res.branchId = params.branchId;
    res.createdAt = params.createdAt;
    res.updatedAt = params.updatedAt;
    return res;
  }
}

export class ShiftAttendanceRes {
  _id!: string;
  attendanceId!: string;
  scheduleId!: string;
  userId!: string;
  branchId?: string;
  date!: string;
  checkInAt?: Date;
  checkOutAt?: Date;
  status!: string;
  createdAt?: Date;
  updatedAt?: Date;

  static from(params: {
    attendanceId: string;
    scheduleId: string;
    userId: string;
    branchId?: string;
    date: string;
    checkInAt?: Date;
    checkOutAt?: Date;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): ShiftAttendanceRes {
    const res = new ShiftAttendanceRes();
    res._id = params.attendanceId;
    res.attendanceId = params.attendanceId;
    res.scheduleId = params.scheduleId;
    res.userId = params.userId;
    res.branchId = params.branchId;
    res.date = params.date;
    res.checkInAt = params.checkInAt;
    res.checkOutAt = params.checkOutAt;
    res.status = params.status;
    res.createdAt = params.createdAt;
    res.updatedAt = params.updatedAt;
    return res;
  }
}
