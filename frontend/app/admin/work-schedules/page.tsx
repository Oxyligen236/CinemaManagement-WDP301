"use client";
import { FormEvent, useEffect, useState } from "react";
import { workScheduleApi } from "@/lib/api/work-schedule.api";
type Form = {
  shiftName: string;
  branchId: string;
  startTime: string;
  endTime: string;
  note: string;
};
const empty: Form = {
  shiftName: "",
  branchId: "",
  startTime: "",
  endTime: "",
  note: "",
};

export default function WorkSchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterBranchId, setFilterBranchId] = useState("");
  const [form, setForm] = useState<Form>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (branchId = filterBranchId) =>
    setRows(await workScheduleApi.list(branchId || undefined));
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    void workScheduleApi
      .branches()
      .then(setBranches)
      .catch((e) => setError(e.message));
  }, []);
  const minutes =
    form.startTime && form.endTime
      ? (Number(form.endTime.slice(0, 2)) * 60 +
          Number(form.endTime.slice(3)) -
          Number(form.startTime.slice(0, 2)) * 60 -
          Number(form.startTime.slice(3)) +
          1440) %
          1440 || 1440
      : 0;
  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) await workScheduleApi.update(editing, form);
      else await workScheduleApi.create(form);
      setForm(empty);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể publish ca");
    } finally {
      setBusy(false);
    }
  }
  async function askDelete(row: any) {
    setBusy(true);
    setError("");
    try {
      const check = await workScheduleApi.canDelete(row.scheduleId);
      if (!check.canDelete) setError(check.reason || "Không thể xóa ca");
      else setPendingDelete(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kiểm tra ca");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await workScheduleApi.remove(pendingDelete.scheduleId);
      setPendingDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa ca");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Quản lý mẫu ca làm việc</h1>
      <form
        onSubmit={publish}
        className="grid max-w-2xl gap-3 rounded border p-5"
      >
        <input
          required
          placeholder="Tên ca"
          value={form.shiftName}
          onChange={(e) => setForm({ ...form, shiftName: e.target.value })}
          className="border p-2"
        />
        <select
          required
          value={form.branchId}
          onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          className="border p-2"
        >
          <option value="">Chọn chi nhánh</option>
          {branches.map((b) => (
            <option key={b.branchId} value={b.branchId}>
              {b.branchName}
            </option>
          ))}
        </select>
        <label>
          Bắt đầu{" "}
          <input
            required
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="border p-2"
          />
        </label>
        <label>
          Kết thúc{" "}
          <input
            required
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="border p-2"
          />
        </label>
        {minutes > 0 && (
          <p className={minutes > 600 ? "text-red-600" : ""}>
            Thời lượng: {Math.floor(minutes / 60)} giờ {minutes % 60} phút
          </p>
        )}
        <textarea
          placeholder="Ghi chú"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="border p-2"
        />
        <div className="flex gap-2">
          <button
            disabled={busy || minutes > 600}
            className="bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {editing ? "Publish thay đổi" : "Publish ca làm"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
              className="border px-4 py-2"
            >
              Hủy
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
      </form>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Mẫu ca</h2>
          <select
            value={filterBranchId}
            onChange={(e) => {
              setFilterBranchId(e.target.value);
              void load(e.target.value);
            }}
            className="border p-2"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
        {rows.map((row) => (
          <article key={row.scheduleId} className="rounded border p-3">
            <b>{row.shiftName}</b> ·{" "}
            {branches.find((b) => b.branchId === row.branchId)?.branchName ||
              row.branchId}
            <div>
              {row.startTime} – {row.endTime}
            </div>
            {row.note && <div className="text-gray-600">{row.note}</div>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setEditing(row.scheduleId);
                  setForm({
                    shiftName: row.shiftName,
                    branchId: row.branchId,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    note: row.note || "",
                  });
                }}
                className="border px-3 py-1"
              >
                Sửa
              </button>
              <button
                disabled={busy}
                onClick={() => void askDelete(row)}
                className="border border-red-600 px-3 py-1 text-red-700 disabled:opacity-50"
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
        {!rows.length && <p className="text-gray-500">Chưa có mẫu ca.</p>}
      </section>
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 grid place-items-center bg-black/40 p-4"
        >
          <div className="max-w-md rounded bg-white p-6">
            <h2 className="text-lg font-bold">Xác nhận xóa ca</h2>
            <p className="mt-2">
              Bạn có chắc chắn muốn xóa ca “{pendingDelete.shiftName}” không?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="border px-4 py-2"
              >
                Hủy
              </button>
              <button
                disabled={busy}
                onClick={() => void remove()}
                className="bg-red-600 px-4 py-2 text-white"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
