export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'USER' | 'CUSTOMER' | string;
  branchId?: string | null;
  jobPosition?: string | null;
  employmentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileReq {
  firstName: string;
  lastName: string;
}

export interface ChangePasswordReq {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordRes {
  message: string;
}
