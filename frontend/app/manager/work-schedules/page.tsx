"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { workScheduleApi } from "@/lib/api/work-schedule.api";

type Schedule = {
  scheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  durationInMinutes: number;
  note?: string;
  userIds: string[];
};

type Staff = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  jobPosition?: string;
  employmentStatus?: string;
};

const positionName: Record<string, string> = {
  TICKET_SELLER: "Nhân viên bán vé",
};

const statusName: Record<string, string> = {
  ACTIVE: "Đang làm việc",
  INACTIVE: "Tạm ngưng",
  RESIGNED: "Đã nghỉ việc",
};

export default function ManagerWorkSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetch dữ liệu khởi tạo an toàn
  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const [shifts, people] = await Promise.all([
          workScheduleApi.managerList(),
          workScheduleApi.managerStaff(),
        ]);

        if (ignore) return;

        setSchedules(shifts);
        setStaff(people);

        if (shifts.length > 0) {
          const firstId = shifts[0].scheduleId;
          setScheduleId(firstId);
          setAssignedIds(shifts[0].userIds || []);
        }
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
        }
      }
    }

    void init();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.scheduleId === scheduleId),
    [schedules, scheduleId],
  );

  const assigned = useMemo(
    () =>
      assignedIds
        .map((id) => staff.find((person) => person.userId === id))
        .filter((person): person is Staff => Boolean(person)),
    [assignedIds, staff],
  );

  const candidates = useMemo(
    () =>
      staff.filter(
        (person) =>
          !assignedIds.includes(person.userId) &&
          `${person.firstName} ${person.lastName} ${person.email}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [staff, assignedIds, search],
  );

  // Hàm reload chỉ dùng sau khi mutate (save, import)
  const refreshSchedules = async (targetScheduleId = scheduleId) => {
    const shifts = await workScheduleApi.managerList();
    setSchedules(shifts);
    const current = shifts.find(
      (s: Schedule) => s.scheduleId === targetScheduleId,
    );
    if (current) {
      setAssignedIds(current.userIds || []);
    }
  };

  const handleShiftChange = (newId: string) => {
    setScheduleId(newId);
    const targetShift = schedules.find((s) => s.scheduleId === newId);
    setAssignedIds(targetShift?.userIds || []);
    setMessage("");
    setError("");
  };

  const save = async (ids = assignedIds) => {
    if (!scheduleId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await workScheduleApi.assign(scheduleId, ids);
      setMessage("Đã lưu danh sách nhân viên cho ca.");
      await refreshSchedules(scheduleId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu phân công");
    } finally {
      setBusy(false);
    }
  };

  const addCandidate = () => {
    if (!candidateId || assignedIds.includes(candidateId)) return;
    setAssignedIds((prev) => [...prev, candidateId]);
    setCandidateId("");
    setSearch("");
  };

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await workScheduleApi.importFile(file);
      setMessage(`Đã import ${result.imported} ca.`);
      await refreshSchedules(scheduleId);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Import thất bại");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  // ... phần JSX return giữ nguyên, chỉ thay onChange của select ca làm việc:
  // onChange={(e) => handleShiftChange(e.target.value)}

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • VẬN HÀNH CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Lịch làm việc Nhân viên
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Chọn ca, xem thông tin nhân viên, rồi lưu danh sách phân công.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() =>
              workScheduleApi.exportTemplate().catch((e) => setError(e.message))
            }
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Tải Excel mẫu
          </button>
          <label className="cursor-pointer rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Import Excel
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={importFile}
            />
          </label>
        </div>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!schedules.length ? (
        <section className="rounded-xl border bg-white p-8 text-center text-gray-500">
          Chưa có ca làm do Admin tạo.
        </section>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <label
              htmlFor="shift-select"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Ca làm việc
            </label>
            <select
              id="shift-select"
              value={scheduleId}
              onChange={(e) => handleShiftChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-red-600 focus:outline-none"
            >
              {schedules.map((s) => (
                <option key={s.scheduleId} value={s.scheduleId}>
                  {s.shiftName} · {s.startTime}–{s.endTime}
                </option>
              ))}
            </select>
            {selectedSchedule && (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="block text-gray-500">Khung giờ</span>
                  <strong className="text-gray-900">
                    {selectedSchedule.startTime} – {selectedSchedule.endTime}
                  </strong>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="block text-gray-500">Thời lượng</span>
                  <strong className="text-gray-900">
                    {Math.floor(selectedSchedule.durationInMinutes / 60)} giờ{" "}
                    {selectedSchedule.durationInMinutes % 60} phút
                  </strong>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="block text-gray-500">Mã ca</span>
                  <strong className="break-all text-gray-900">
                    {selectedSchedule.scheduleId}
                  </strong>
                </div>
                {selectedSchedule.note && (
                  <p className="sm:col-span-3 text-gray-600">
                    Ghi chú: {selectedSchedule.note}
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">
              Thêm nhân viên vào ca
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc email"
                aria-label="Tìm nhân viên"
                className="rounded-lg border border-gray-300 p-3 text-sm focus:border-red-600 focus:outline-none"
              />
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                aria-label="Chọn nhân viên"
                className="rounded-lg border border-gray-300 bg-white p-3 text-sm"
              >
                <option value="">Chọn nhân viên ({candidates.length})</option>
                {candidates.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.firstName} {person.lastName} · {person.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!candidateId}
                onClick={addCandidate}
                className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Thêm vào ca
              </button>
            </div>
            {candidateId && staff.find((p) => p.userId === candidateId) && (
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {staff.find((p) => p.userId === candidateId)?.firstName}{" "}
                {staff.find((p) => p.userId === candidateId)?.lastName} ·{" "}
                {staff.find((p) => p.userId === candidateId)?.email} ·{" "}
                {positionName[
                  staff.find((p) => p.userId === candidateId)?.jobPosition || ""
                ] || "Nhân viên"}{" "}
                ·{" "}
                {statusName[
                  staff.find((p) => p.userId === candidateId)
                    ?.employmentStatus || ""
                ] || "Đang làm việc"}
              </p>
            )}
          </section>
          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Nhân viên được phân công
                </h2>
                <p className="text-sm text-gray-500">
                  {assigned.length} nhân viên trong ca
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => void save()}
                className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {busy ? "Đang lưu…" : "Lưu phân công"}
              </button>
            </div>
            {!assigned.length ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Chưa có nhân viên. Chọn người ở phía trên để thêm.
              </p>
            ) : (
              <div className="divide-y">
                {assigned.map((person) => (
                  <article
                    key={person.userId}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 font-semibold text-red-700">
                        {`${person.firstName[0] || ""}${person.lastName[0] || ""}`.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="truncate text-sm text-gray-500">
                          {person.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {positionName[person.jobPosition || ""] ||
                            "Nhân viên"}{" "}
                          ·{" "}
                          {statusName[person.employmentStatus || ""] ||
                            "Đang làm việc"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAssignedIds(
                          assignedIds.filter((id) => id !== person.userId),
                        )
                      }
                      aria-label={`Xóa ${person.firstName} ${person.lastName} khỏi ca`}
                      className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-red-300 hover:text-red-700"
                    >
                      Xóa
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
