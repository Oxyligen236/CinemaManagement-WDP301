export class AdminInfoRes {
  userId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;

  static of(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
  ): AdminInfoRes {
    const res = new AdminInfoRes();
    Object.assign(res, { userId, email, firstName, lastName });
    return res;
  }
}

export class AdminDashboardStatsRes {
  totalUsers!: number;
  activeUsers!: number;
  inactiveUsers!: number;
  registeredUsers?: number;
  uploadedFilesCount?: number;
  usersByRole!: Record<string, number>;

  static of(
    totalUsers: number,
    activeUsers: number,
    inactiveUsers: number,
    usersByRole: Record<string, number>,
    registeredUsers?: number,
    uploadedFilesCount?: number,
  ): AdminDashboardStatsRes {
    const res = new AdminDashboardStatsRes();
    Object.assign(res, {
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRole,
      registeredUsers: registeredUsers ?? 0,
      uploadedFilesCount: uploadedFilesCount ?? 0,
    });
    return res;
  }
}

export class AdminDashboardRes {
  message!: string;
  admin!: AdminInfoRes;
  stats!: AdminDashboardStatsRes;

  static of(
    message: string,
    admin: AdminInfoRes,
    stats: AdminDashboardStatsRes,
  ): AdminDashboardRes {
    const res = new AdminDashboardRes();
    Object.assign(res, { message, admin, stats });
    return res;
  }
}

export class AdminUserItemRes {
  userId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: string;
  isActive!: boolean;
  branchId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  static of(params: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    branchId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): AdminUserItemRes {
    const res = new AdminUserItemRes();
    Object.assign(res, params);
    return res;
  }
}

export class AdminUsersListRes {
  users!: AdminUserItemRes[];
  total!: number;

  static of(users: AdminUserItemRes[], total: number): AdminUsersListRes {
    const res = new AdminUsersListRes();
    Object.assign(res, { users, total });
    return res;
  }
}

export class AdminUserDetailRes {
  user!: AdminUserItemRes;

  static of(user: AdminUserItemRes): AdminUserDetailRes {
    const res = new AdminUserDetailRes();
    Object.assign(res, { user });
    return res;
  }
}

export class AdminBranchItemRes {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: string;

  static of(
    branchId: string,
    branchName: string,
    address: string,
    branchStatus: string,
  ): AdminBranchItemRes {
    const res = new AdminBranchItemRes();
    Object.assign(res, { branchId, branchName, address, branchStatus });
    return res;
  }
}

export class AdminBranchesListRes {
  branches!: AdminBranchItemRes[];

  static of(branches: AdminBranchItemRes[]): AdminBranchesListRes {
    const res = new AdminBranchesListRes();
    Object.assign(res, { branches });
    return res;
  }
}

export class AdminUserMutateRes {
  message!: string;
  user!: AdminUserItemRes;

  static of(message: string, user: AdminUserItemRes): AdminUserMutateRes {
    const res = new AdminUserMutateRes();
    Object.assign(res, { message, user });
    return res;
  }
}
