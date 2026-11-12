export class WorkScheduleResDto {
  scheduleId!: string;
  id?: string;
  shiftName!: string;
  startTime?: string;
  endTime?: string;
  durationInMinutes?: number;
  isOvernight?: boolean;
  isActive?: boolean;
  branchId?: string | null;
  userIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;

  static of(params: {
    scheduleId: string;
    id?: string;
    shiftName: string;
    startTime?: string;
    endTime?: string;
    durationInMinutes?: number;
    isOvernight?: boolean;
    isActive?: boolean;
    branchId?: string | null;
    userIds?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    [key: string]: any;
  }): WorkScheduleResDto {
    const res = new WorkScheduleResDto();
    Object.assign(res, params);
    if (!res.scheduleId && params.id) {
      res.scheduleId = params.id;
    }
    return res;
  }
}

export class WorkStaffItemDto {
  userId!: string;
  id?: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  jobPosition?: string | null;
  employmentStatus?: string | null;

  static of(params: {
    userId: string;
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    jobPosition?: string | null;
    employmentStatus?: string | null;
  }): WorkStaffItemDto {
    const res = new WorkStaffItemDto();
    Object.assign(res, params);
    return res;
  }
}

export class WorkCanDeleteResDto {
  canDelete!: boolean;
  reason?: string;

  static of(canDelete: boolean, reason?: string): WorkCanDeleteResDto {
    const res = new WorkCanDeleteResDto();
    Object.assign(res, { canDelete, reason });
    return res;
  }
}

export class WorkDailyAssignmentDto {
  scheduleId!: string;
  shiftName!: string;
  startTime!: string;
  endTime!: string;
  durationInMinutes?: number;
  isOvernight?: boolean;
  isActive?: boolean;
  branchId?: string | null;
  userIds?: string[];
  assignments!: any[];

  static of(params: {
    scheduleId: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    durationInMinutes?: number;
    isOvernight?: boolean;
    isActive?: boolean;
    branchId?: string | null;
    userIds?: string[];
    assignments: any[];
    [key: string]: any;
  }): WorkDailyAssignmentDto {
    const res = new WorkDailyAssignmentDto();
    Object.assign(res, params);
    return res;
  }
}

export class WorkShiftStatsResDto {
  revenue!: number;
  tickets!: number;
  products!: number;
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  scheduleId?: string | null;

  static of(params: {
    revenue: number;
    tickets: number;
    products: number;
    checkInAt?: Date | null;
    checkOutAt?: Date | null;
    scheduleId?: string | null;
  }): WorkShiftStatsResDto {
    const res = new WorkShiftStatsResDto();
    Object.assign(res, params);
    return res;
  }
}

export class MyShiftResDto {
  scheduleId!: string;
  shiftName!: string;
  startTime!: string;
  endTime!: string;
  durationInMinutes?: number;
  isOvernight?: boolean;
  isActive?: boolean;
  branchId?: string | null;
  userIds?: string[];
  attendance?: any;

  static of(params: any): MyShiftResDto {
    const res = new MyShiftResDto();
    Object.assign(res, params);
    return res;
  }
}
