'use client';

import { useEffect, useState } from 'react';
import { Film, Loader2, Popcorn, Ticket, TrendingDown, TrendingUp } from 'lucide-react';

type Movie = { movieId: string; movieName: string; ticketsSold: number; ticketRevenue?: number };
type Product = { productId: string; productName: string; category: string; quantitySold: number; revenue: number };
type Report = { totalTicketsSold: number; totalTicketRevenue: number; totalProductsSold: number; totalProductRevenue: number; products: Product[]; productsByCategory: Pick<Product, 'category' | 'quantitySold' | 'revenue'>[]; topSellingMovie: Movie | null; lowestSellingMovie: Movie | null; dailyShowtimeChart: (Movie & { showtimeCount: number; ticketRevenue: number })[] };
type Branch = { branchId: string; branchName: string };

const today = () => new Date().toISOString().slice(0, 10);
const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const currency = (value: number) => `${number(value)} ₫`;

export default function FinancialStatisticsView({ admin = false }: { admin?: boolean }) {
  const [date, setDate] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

  useEffect(() => {
    if (!admin) return;
    const token = localStorage.getItem('cinema_access_token');
    fetch(`${api}/admin/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((r) => setBranches(r.branches ?? []))
      .catch(() => setError('Không thể tải danh sách chi nhánh.'));
  }, [admin, api]);

  useEffect(() => {
    const token = localStorage.getItem('cinema_access_token');
    const query = new URLSearchParams({ date, ...(branchId && { branchId }) });
    setLoading(true); setError('');
    fetch(`${api}/statistics/financial?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => r.ok ? r.json() : Promise.reject(await r.json()))
      .then(setData)
      .catch(() => { setData(null); setError('Không thể tải báo cáo thống kê.'); })
      .finally(() => setLoading(false));
  }, [api, branchId, date]);

  const max = Math.max(...(data?.dailyShowtimeChart.map((item) => item.ticketsSold) ?? []), 1);
  const cards = data ? [
    { label: 'Tổng vé bán ra', value: number(data.totalTicketsSold), icon: Ticket },
    { label: 'Doanh thu vé', value: currency(data.totalTicketRevenue), icon: Ticket },
    { label: 'Tổng bắp nước bán ra', value: number(data.totalProductsSold), icon: Popcorn },
    { label: 'Doanh thu F&B', value: currency(data.totalProductRevenue), icon: Popcorn },
    { label: 'Phim bán chạy nhất', value: data.topSellingMovie?.movieName ?? 'Chưa có dữ liệu', note: data.topSellingMovie && `${number(data.topSellingMovie.ticketsSold)} vé`, icon: TrendingUp },
    { label: 'Phim bán ít nhất', value: data.lowestSellingMovie?.movieName ?? 'Chưa có dữ liệu', note: data.lowestSellingMovie && `${number(data.lowestSellingMovie.ticketsSold)} vé`, icon: TrendingDown },
  ] : [];
  return <div className="space-y-6 font-['Arial',sans-serif]">
    <div className="border-b-2 border-[#231f20] pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">LATTE CINEMA • BÁO CÁO BÁN HÀNG</p><h1 className="mt-1 text-[24px] font-bold uppercase text-[#231f20]">Báo cáo Thống kê {admin ? 'Hệ thống' : 'Chi nhánh'}</h1><p className="mt-1 text-[13px] text-[#666]">Số vé, sản phẩm và hiệu suất phim theo ngày.</p></div>
    <div className="flex flex-wrap gap-3 border border-[#e3e1d6] bg-white p-4"><label className="text-[13px] font-bold text-[#231f20]">Ngày<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-2 h-9 border border-[#dad2b4] px-2 font-normal" /></label>{admin && <label className="text-[13px] font-bold text-[#231f20]">Chi nhánh<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="ml-2 h-9 border border-[#dad2b4] bg-white px-2 font-normal"><option value="">Toàn hệ thống</option>{branches.map((branch) => <option key={branch.branchId} value={branch.branchId}>{branch.branchName}</option>)}</select></label>}</div>
    {loading && <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#da291c]" /></div>}{error && <p className="border border-[#da291c] bg-[#fff5f4] p-4 text-[13px] text-[#da291c]">{error}</p>}
    {data && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon }) => <div key={label} className="border border-[#e3e1d6] bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#da291c]" /><p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">{label}</p><p className="mt-1 truncate text-[20px] font-bold text-[#231f20]">{value}</p>{note && <p className="mt-1 text-[13px] text-[#666]">{note}</p>}</div>)}</div>
    <section className="border border-[#e3e1d6] bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-[#e3e1d6] bg-[#efebdb] px-5 py-3"><Film className="h-4 w-4 text-[#da291c]" /><h2 className="text-[13px] font-bold uppercase text-[#231f20]">Vé bán theo phim có suất chiếu trong ngày</h2></div><div className="p-5">{data.dailyShowtimeChart.length ? <><div className="mb-5 ml-[35%] grid grid-cols-5 text-[11px] text-[#6f6247]"><span>0 vé</span><span>{number(Math.round(max / 4))}</span><span>{number(Math.round(max / 2))}</span><span>{number(Math.round(max * .75))}</span><span className="text-right">{number(max)} vé</span></div><div className="space-y-5">{data.dailyShowtimeChart.map((item) => <div key={item.movieId} className="grid grid-cols-[minmax(110px,35%)_1fr] gap-3"><div className="text-[13px]"><p className="truncate font-bold text-[#231f20]">{item.movieName}</p><p className="text-[#666]">{item.showtimeCount} suất</p></div><div><div className="mb-1 flex justify-between text-[12px] text-[#6f6247]"><span>{number(item.ticketsSold)} vé</span><span>{currency(item.ticketRevenue)}</span></div><div className="relative h-5 bg-[linear-gradient(to_right,#efebdb_1px,transparent_1px)] bg-[size:25%_100%] bg-[#f7f5ed]"><div className="h-full bg-[#da291c]" style={{ width: `${item.ticketsSold / max * 100}%` }} /></div></div></div>)}</div><p className="mt-4 text-[11px] text-[#6f6247]">Trục ngang: số vé đã thanh toán. Số tiền: doanh thu vé tương ứng.</p></> : <p className="py-8 text-center text-[13px] text-[#666]">Không có suất chiếu bắt đầu trong ngày đã chọn.</p>}</div></section>
    <section className="grid gap-6 xl:grid-cols-2"><div className="border border-[#e3e1d6] bg-white shadow-sm"><h2 className="border-b border-[#e3e1d6] bg-[#efebdb] px-5 py-3 text-[13px] font-bold uppercase">Doanh thu theo hạng mục</h2><div className="divide-y divide-[#e3e1d6]">{data.productsByCategory.map((item) => <div key={item.category} className="flex justify-between px-5 py-3 text-[13px]"><span className="font-bold">{item.category}</span><span>{number(item.quantitySold)} sản phẩm · <b>{currency(item.revenue)}</b></span></div>)}</div></div><div className="border border-[#e3e1d6] bg-white shadow-sm"><h2 className="border-b border-[#e3e1d6] bg-[#efebdb] px-5 py-3 text-[13px] font-bold uppercase">Chi tiết sản phẩm bán ra</h2><div className="max-h-80 overflow-auto"><table className="w-full text-left text-[13px]"><thead className="sticky top-0 bg-white text-[#6f6247]"><tr><th className="p-3">Sản phẩm</th><th>Loại</th><th>SL</th><th className="p-3 text-right">Doanh thu</th></tr></thead><tbody>{data.products.map((item) => <tr key={item.productId} className="border-t border-[#e3e1d6]"><td className="p-3 font-bold">{item.productName}</td><td>{item.category}</td><td>{number(item.quantitySold)}</td><td className="p-3 text-right">{currency(item.revenue)}</td></tr>)}</tbody></table></div></div></section></>}
  </div>;
}
