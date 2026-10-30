export class AdminInfoRes {
  userId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
}

export class AdminDashboardStatsRes {
  totalUsers!: number;
  activeUsers!: number;
  inactiveUsers!: number;
  registeredUsers!: number;
  uploadedFilesCount!: number;
  usersByRole!: Record<string, number>;
}

export class AdminDashboardRes {
  message!: string;
  admin!: AdminInfoRes;
  stats!: AdminDashboardStatsRes;
}
