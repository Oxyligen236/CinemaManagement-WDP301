import { Role } from './enums/role.enum';

/**
 * Value của `Role.BRANCHMANAGER` đã từng được đổi giữa 'BRANCHMANAGER' và
 * 'MANAGER', nên collection `users` đang chứa lẫn cả hai value cho cùng một
 * vai trò Quản lý Chi nhánh, và các access token đã phát cũng vậy.
 *
 * Mọi so sánh role phải chuẩn hóa qua `normalizeRole` trước khi dùng, thay vì
 * so sánh thẳng với `Role.BRANCHMANAGER` (so sánh thẳng là nguyên nhân khiến
 * Branch Manager bị 403 khi vào trang quản lý nhân viên chi nhánh).
 */
const ROLE_ALIASES: Record<string, Role> = {
  MANAGER: Role.BRANCHMANAGER,
  BRANCHMANAGER: Role.BRANCHMANAGER,
  BRANCH_MANAGER: Role.BRANCHMANAGER,
};

/**
 * Tất cả value có thể gặp trong database cho vai trò Quản lý Chi nhánh.
 * Dùng cho các query Mongoose dạng `role: { $in: BRANCH_MANAGER_ROLE_VALUES }`.
 *
 * Ép kiểu về `Role[]`: các value cũ ('BRANCHMANAGER', 'BRANCH_MANAGER') không
 * còn nằm trong enum nhưng vẫn tồn tại trong dữ liệu, nên vẫn phải query.
 */
export const BRANCH_MANAGER_ROLE_VALUES = Object.keys(ROLE_ALIASES) as Role[];

/**
 * Đưa một role thô (từ database, JWT payload hoặc request) về đúng value
 * canonical của enum `Role`.
 *
 * @param role - Role thô, có thể là value cũ hoặc khác hoa/thường.
 * @returns Role canonical, hoặc `undefined` nếu không khớp vai trò nào.
 */
export function normalizeRole(role?: string | null): Role | undefined {
  if (typeof role !== 'string') return undefined;

  const value = role.trim().toUpperCase();
  const alias = ROLE_ALIASES[value];
  if (alias) return alias;

  return (Object.values(Role) as string[]).includes(value)
    ? (value as Role)
    : undefined;
}

/** Kiểm tra một role thô có phải vai trò Quản lý Chi nhánh hay không. */
export function isBranchManagerRole(role?: string | null): boolean {
  return normalizeRole(role) === Role.BRANCHMANAGER;
}
