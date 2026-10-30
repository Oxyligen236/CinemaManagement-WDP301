"use client";

import { useEffect, useState } from "react";
import { workScheduleApi } from "@/lib/api/work-schedule.api";

type Staff = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};
type Assignment = {
  userId: string;
  user?: Staff;
  attendance?: { status: string; checkInAt?: string } | null;
};
type Shift = {
  scheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  assignments: Assignment[];
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function ManagerWorkSchedulesPage() {
  const [date, setDate] = useState(today);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = async () => {
    const [daily, people] = await Promise.all([
      workScheduleApi.daily(date),
      workScheduleApi.managerStaff(),
    ]);
    setShifts(daily);
    setStaff(people);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [date]);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật");
    } finally {
      setBusy("");
    }
  };
  const status = (a: Assignment) =>
    a.attendance?.status === "COMPLETED"
      ? "Đã kết thúc"
      : a.attendance?.status === "IN_PROGRESS"
        ? "Đang làm"
        : a.attendance?.status === "ABSENT"
          ? "Vắng"
          : "Chưa check-in";
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-[11px] font-bold tracking-[.2em] text-[#da291c]">
          LATTE CINEMA • VẬN HÀNH CHI NHÁNH
        </p>
        <h1 className="text-2xl font-bold uppercase">Phân ca theo ngày</h1>
        <p className="text-sm text-gray-600">
          Mỗi nhân viên chỉ được gán một ca không chồng giờ trong ngày.
        </p>
      </header>
      <section className="flex gap-3 border bg-white p-4">
        <label className="font-semibold">
          Ngày{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 border p-2"
          />
        </label>
      </section>
      {error && (
        <p
          role="alert"
          className="border border-red-300 bg-red-50 p-3 text-red-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4">
        {shifts.map((shift) => (
          <section key={shift.scheduleId} className="border bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#efebdb] p-4">
              <div>
                <h2 className="font-bold">{shift.shiftName}</h2>
                <p className="text-sm">
                  {shift.startTime} – {shift.endTime} ·{" "}
                  {shift.assignments.length} nhân viên
                </p>
              </div>
              <button
                disabled={busy === shift.scheduleId}
                onClick={() =>
                  void act(shift.scheduleId, () =>
                    workScheduleApi.closeDay(shift.scheduleId, date),
                  )
                }
                className="border px-3 py-2 text-sm"
              >
                Đóng ca
              </button>
            </header>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={pick[shift.scheduleId] ?? ""}
                  onChange={(e) =>
                    setPick({ ...pick, [shift.scheduleId]: e.target.value })
                  }
                  className="min-w-60 border p-2"
                >
                  <option value="">Chọn nhân viên</option>
                  {staff
                    .filter(
                      (person) =>
                        !shift.assignments.some(
                          (a) => a.userId === person.userId,
                        ),
                    )
                    .map((person) => (
                      <option key={person.userId} value={person.userId}>
                        {person.firstName} {person.lastName} · {person.email}
                      </option>
                    ))}
                </select>
                <button
                  disabled={
                    !pick[shift.scheduleId] || busy === shift.scheduleId
                  }
                  onClick={() =>
                    void act(shift.scheduleId, () =>
                      workScheduleApi.assignDay(
                        shift.scheduleId,
                        date,
                        pick[shift.scheduleId],
                      ),
                    )
                  }
                  className="bg-[#da291c] px-4 py-2 text-sm font-bold text-white"
                >
                  Phân ca
                </button>
              </div>
              <div className="mt-4 divide-y">
                {shift.assignments.length ? (
                  shift.assignments.map((assignment) => (
                    <div
                      key={assignment.userId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <b>
                          {assignment.user
                            ? `${assignment.user.firstName} ${assignment.user.lastName}`
                            : assignment.userId}
                        </b>
                        <p className="text-xs text-gray-500">
                          {assignment.user?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {status(assignment)}
                        </span>
                        <button
                          disabled={busy === assignment.userId}
                          onClick={() =>
                            void act(assignment.userId, () =>
                              workScheduleApi.unassignDay(
                                shift.scheduleId,
                                date,
                                assignment.userId,
                              ),
                            )
                          }
                          className="text-sm text-red-700"
                        >
                          Gỡ
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-sm text-gray-500">Chưa phân công.</p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
