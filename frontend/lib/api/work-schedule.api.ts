const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cinema_access_token') || ''}` });
export const workScheduleApi = {
  branches: () => fetch(`${API}/branches/admin?limit=100`, { headers: headers() }).then(async r => { if (!r.ok) throw new Error('Không thể tải chi nhánh'); const data = await r.json(); return Array.isArray(data) ? data : Array.isArray(data.branches) ? data.branches : []; }),
  list: (branchId?: string) => fetch(`${API}/admin/work-schedules${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`, { headers: headers() }).then(r => r.json()),
  create: (body: { shiftName: string; branchId: string; startTime: string; endTime: string; note?: string }) => fetch(`${API}/admin/work-schedules`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(async r => { if (!r.ok) throw new Error((await r.json()).message || 'Không thể tạo ca'); return r.json(); }),
};
