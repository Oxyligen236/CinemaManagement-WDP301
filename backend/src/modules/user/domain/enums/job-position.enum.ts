/**
 * Vị trí công việc của nhân viên chi nhánh (UC19 / BR-BRM-14).
 * Danh sách vị trí mà Branch Manager được phép gán nằm ở
 * staff/domain/staff.rules.ts (BRANCH_ASSIGNABLE_POSITIONS).
 */
export enum JobPosition {
  TICKET_SELLER = 'TICKET_SELLER',
  CONCESSION_STAFF = 'CONCESSION_STAFF',
  USHER = 'USHER',
  PROJECTIONIST = 'PROJECTIONIST',
  CLEANER = 'CLEANER',
  SHIFT_SUPERVISOR = 'SHIFT_SUPERVISOR',
}
