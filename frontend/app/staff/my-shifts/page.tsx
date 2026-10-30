"use client";

import { useCallback, useEffect, useState } from "react";
import { workScheduleApi } from "@/lib/api/work-schedule.api";

type Schedule = {
  scheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  note?: string;
};
type Attendance = {
  scheduleId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABSENT";
  checkInAt?: string;
  checkOutAt?: string;
};
type Stats = {
  revenue: number;
  tickets: number;
  products: number;
  scheduleId?: string;
  checkInAt?: string;
  checkOutAt?: string;
};
const vnMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts();
  return (
    Number(parts.find((x) => x.type === "hour")?.value) * 60 +
    Number(parts.find((x) => x.type === "minute")?.value)
  );
};
const vnDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const scheduledStatus = (shift: Schedule, attendance?: Attendance | null) => {
  if (attendance?.status === "IN_PROGRESS")
    return ["Đang trong ca", "bg-green-100 text-green-800"];
  if (attendance?.status === "COMPLETED")
    return ["Ca đã kết thúc", "bg-gray-100 text-gray-700"];
  if (attendance?.status === "ABSENT")
    return ["Vắng mặt", "bg-red-100 text-red-800"];
  const now = vnMinutes(),
    start = minutes(shift.startTime),
    end = minutes(shift.endTime);
  const inShift =
    end > start ? now >= start && now < end : now >= start || now < end;
  const opensAt = (start + 1440 - 60) % 1440;
  const open =
    end > start ? now >= start - 60 && now < end : now >= opensAt || now < end;
  return inShift
    ? ["Đang trong giờ ca · Chưa check-in", "bg-amber-100 text-amber-900"]
    : open
      ? ["Đã mở ca · Chưa check-in", "bg-blue-100 text-blue-800"]
      : now < start
        ? ["Chưa mở ca", "bg-blue-100 text-blue-800"]
        : ["Đã hết giờ ca", "bg-gray-100 text-gray-700"];
};

export default function MyShiftsPage() {
  const [date, setDate] = useState(vnDate);
  const [shifts, setShifts] = useState<
    (Schedule & { attendance?: Attendance | null })[]
  >([]);
  const [stats, setStats] = useState<Stats>({
    revenue: 0,
    tickets: 0,
    products: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const isToday = date === vnDate();
  const load = useCallback(async () => {
    const assigned = await workScheduleApi.myShifts(date);
    setShifts(assigned);
    if (date === vnDate()) setStats(await workScheduleApi.stats());
    else setStats({ revenue: 0, tickets: 0, products: 0 });
  }, [date]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = window.setInterval(() => {
      setClock((x) => x + 1);
      void load().catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  const act = async (scheduleId?: string, end = false) => {
    setBusy(true);
    setError("");
    try {
      if (end) await workScheduleApi.endShift();
      else if (scheduleId) await workScheduleApi.startShift(scheduleId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật ca");
    } finally {
      setBusy(false);
    }
  };
  const hasActiveShift = shifts.some(
    (shift) => shift.attendance?.status === "IN_PROGRESS",
  );
  const canStart = (shift: Schedule, attendance?: Attendance | null) => {
    const now = vnMinutes(),
      start = minutes(shift.startTime),
      end = minutes(shift.endTime);
    const opensAt = (start + 1440 - 60) % 1440;
    const inWindow =
      end > start
        ? now >= start - 60 && now < end
        : now >= opensAt || now < end;
    return isToday && !attendance && !hasActiveShift && inWindow;
  };
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Ca làm của tôi</h1>
        <p className="text-sm text-gray-500">
          Giờ rạp Việt Nam · chỉ mở ca trong 60 phút trước giờ bắt đầu.
        </p>
      </header>
      <section className="flex items-center gap-3 rounded border bg-white p-4">
        <label className="font-medium">
          Ngày{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 border p-2"
          />
        </label>
        <button
          onClick={() => setDate(vnDate())}
          className="border px-3 py-2 text-sm"
        >
          Hôm nay
        </button>
      </section>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {hasActiveShift && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Bạn đang trong ca làm. Hãy kết thúc ca hiện tại trước khi bắt đầu ca
          khác.
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Doanh thu ca",
            `${Number(stats.revenue).toLocaleString("vi-VN")} ₫`,
          ],
          ["Vé đã bán", stats.tickets],
          ["Sản phẩm F&B", stats.products],
        ].map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-lg border bg-white p-5"
          >
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        {shifts.map((shift) => {
          const attendance = shift.attendance;
          const active = attendance?.status === "IN_PROGRESS";
          const [label, color] = scheduledStatus(shift, attendance);
          return (
            <article
              key={shift.scheduleId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">
                    {shift.shiftName}
                  </h2>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${color}`}
                  >
                    {label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {shift.startTime} – {shift.endTime}
                </p>
                {attendance?.checkInAt && (
                  <p className="text-xs text-gray-500">
                    Bắt đầu:{" "}
                    {new Date(attendance.checkInAt).toLocaleString("vi-VN")}
                    {attendance.checkOutAt
                      ? ` · Kết thúc: ${new Date(attendance.checkOutAt).toLocaleString("vi-VN")}`
                      : ""}
                  </p>
                )}
                {shift.note && <p className="text-sm">{shift.note}</p>}
              </div>
              {active ? (
                <button
                  disabled={busy || !isToday}
                  onClick={() => void act(undefined, true)}
                  className="rounded bg-gray-800 px-4 py-2 text-white disabled:opacity-50"
                >
                  Kết thúc ca
                </button>
              ) : (
                <button
                  disabled={busy || !canStart(shift, attendance)}
                  onClick={() => void act(shift.scheduleId)}
                  className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
                >
                  {attendance
                    ? "Đã xử lý"
                    : !isToday
                      ? "Chỉ xem lịch"
                      : "Bắt đầu ca"}
                </button>
              )}
            </article>
          );
        })}
        {!shifts.length && (
          <p className="text-gray-500">Bạn chưa được phân ca ngày này.</p>
        )}
      </section>
      <span className="hidden">{clock}</span>
    </main>
  );
}
