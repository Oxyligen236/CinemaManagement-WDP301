export class UserProfileRes {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId?: string | null;
  jobPosition?: string | null;
  employmentStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    branchId?: string | null;
    jobPosition?: string | null;
    employmentStatus?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileRes {
    const res = new UserProfileRes();
    res.id = entity.id;
    res.email = entity.email;
    res.firstName = entity.firstName;
    res.lastName = entity.lastName;
    res.role = entity.role;
    res.branchId = entity.branchId ?? null;
    res.jobPosition = entity.jobPosition ?? null;
    res.employmentStatus = entity.employmentStatus ?? null;
    res.createdAt = entity.createdAt;
    res.updatedAt = entity.updatedAt;
    return res;
  }
}
