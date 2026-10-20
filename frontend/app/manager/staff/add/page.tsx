import Link from 'next/link';
import { UserPlus, ArrowLeft } from 'lucide-react';

export default function AddBranchStaffPage() {
  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • NHÂN SỰ CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Thêm Nhân viên Chi nhánh
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Tạo tài khoản nhân viên mới trực thuộc chi nhánh quản lý (mặc định gán quyền STAFF và chi nhánh hiện tại).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/manager/staff"
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Danh sách Nhân viên
          </Link>
        </div>
      </div>

      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Biểu mẫu Cấp tài khoản Nhân viên
          </span>
          <span className="text-[12px] text-[#6f6247]">
            Lotte Cinema Nam Sài Gòn
          </span>
        </div>

        <div className="p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
            <UserPlus className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-[18px] font-bold text-[#231f20]">
            Màn hình Thêm Nhân viên Chi nhánh
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] text-[#666]">
            Route <code className="bg-[#efebdb] border border-[#dad2b4] px-1.5 py-0.5 font-mono text-[12px] text-[#231f20]">/manager/staff/add</code> đã được kết nối thành công từ Danh sách Nhân viên Chi nhánh (<code className="bg-[#efebdb] border border-[#dad2b4] px-1.5 py-0.5 font-mono text-[12px] text-[#231f20]">/manager/staff</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
