'use client';

import React, { useState, useEffect } from 'react';
import { OrderDetail, OrderStatus, OrderSummary } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { AlertCircle } from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Cancel order state
  const [cancellingOrder, setCancellingOrder] = useState<OrderSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await orderApi.getAdminOrders({
          page,
          limit,
          userId: userIdFilter.trim() || undefined,
          status: statusFilter,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
        if (!ignore) {
          setOrders(res.items);
          setTotal(res.total);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setOrders([]);
          setTotal(0);
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể kết nối đến máy chủ để tải đơn hàng. Vui lòng thử lại.'
          );
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [page, limit, userIdFilter, statusFilter, fromDate, toDate, refreshKey]);

  const handleCancelOrder = async () => {
    if (!cancellingOrder) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      await orderApi.cancelAdminOrder(cancellingOrder.orderId, cancelReason.trim() || undefined);
      setCancellingOrder(null);
      setCancelReason('');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Hủy đơn hàng thất bại');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenDetail = async (orderId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await orderApi.getOrderDetail(orderId);
      setSelectedOrderDetail(detail);
      setIsDetailOpen(true);
    } catch {
      alert('Không thể tải chi tiết đơn hàng từ máy chủ.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleResetFilters = () => {
    setUserIdFilter('');
    setStatusFilter(undefined);
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
            <span>Quản trị</span>
            <span>/</span>
            <span className="text-text-main font-semibold">Vé & Đơn hàng</span>
          </nav>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            Quản trị đơn hàng toàn hệ thống
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Tra cứu, kiểm tra doanh thu, chi tiết vé xem phim và F&B của khách hàng và quầy vé
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-5 rounded-xl border border-border-main shadow-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Mã khách hàng / User ID"
            placeholder="Lọc theo User ID..."
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setPage(1);
            }}
          />

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Trạng thái đơn hàng
            </label>
            <select
              value={statusFilter || ''}
              onChange={(e) => {
                setStatusFilter((e.target.value as OrderStatus) || undefined);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán (PAID)</option>
              <option value="PENDING">Chờ thanh toán (PENDING)</option>
              <option value="CANCELLED">Đã hủy (CANCELLED)</option>
              <option value="EXPIRED">Hết hạn (EXPIRED)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            />
          </div>
        </div>

        {(userIdFilter || statusFilter || fromDate || toDate) && (
          <div className="flex justify-end pt-2 border-t border-border-main">
            <Button size="sm" variant="ghost" onClick={handleResetFilters}>
              Đặt lại bộ lọc
            </Button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : orders.length === 0 ? (
        <div className="p-10 text-center bg-surface rounded-xl border border-border-main space-y-2">
          <p className="text-sm font-semibold text-text-main">Không tìm thấy đơn hàng nào</p>
          <p className="text-xs text-text-sub">Thử nới lỏng các điều kiện lọc để xem kết quả.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-main bg-surface shadow-card">
          <table className="w-full text-left text-sm text-text-main">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-text-sub border-b border-border-main">
              <tr>
                <th className="px-4 py-3">Mã đơn hàng</th>
                <th className="px-4 py-3">Chi nhánh / Rạp</th>
                <th className="px-4 py-3">Khách hàng / User ID</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Số lượng vé</th>
                <th className="px-4 py-3 text-center">F&B</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border-main">
              {orders.map((o) => (
                <tr key={o.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-text-main">
                    #{o.orderId.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-main font-medium">
                    {o.branchName || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sub font-mono">
                    {o.userId}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sub">
                    {formatDateTime(o.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {o.ticketCount > 0 ? (
                      <span className="font-semibold text-text-main">{o.ticketCount} vé</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {o.hasProducts ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        Có F&B
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary-600">
                    {formatCurrency(o.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {o.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setCancellingOrder(o);
                            setCancelReason('');
                            setCancelError(null);
                          }}
                        >
                          Hủy đơn
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenDetail(o.orderId)}
                        isLoading={isLoadingDetail && selectedOrderDetail?.orderId === o.orderId}
                      >
                        Xem chi tiết
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-text-muted">
            Hiển thị {orders.length} trên tổng số {total} đơn hàng
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <span className="text-xs text-text-sub flex items-center px-2">
              Trang {page} / {Math.ceil(total / limit)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <OrderDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrderDetail(null);
        }}
        order={selectedOrderDetail}
        mode="admin"
        onOrderUpdated={() => setRefreshKey((k) => k + 1)}
      />

      {/* Admin Cancel Order Modal */}
      {cancellingOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-150"
        >
          <div className="bg-surface w-full max-w-md rounded-xl border border-border-main p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-status-danger rounded-full shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[16px] text-text-main">
                  Quản trị viên hủy đơn hàng
                </h4>
                <p className="text-[12px] text-text-muted font-mono mt-0.5">
                  Mã đơn: #{cancellingOrder.orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-text-sub leading-relaxed">
              Bạn có chắc chắn muốn hủy đơn hàng này không? Ghế và các dịch vụ giữ chỗ sẽ được hoàn lại hệ thống ngay lập tức.
            </p>

            <div>
              <label className="block text-[12px] font-bold text-text-main mb-1.5">
                Lý do hủy đơn (tùy chọn)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do quản trị viên hủy đơn..."
                rows={3}
                className="w-full text-[13px] border border-border-main rounded-lg p-2.5 bg-surface text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-600 focus:border-primary-600 transition-all resize-none"
              />
            </div>

            {cancelError && (
              <p className="text-[12px] text-status-danger bg-red-50 p-2.5 rounded-lg border border-red-200">
                {cancelError}
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isCancelling}
                onClick={() => {
                  setCancellingOrder(null);
                  setCancelError(null);
                }}
              >
                Đóng
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isCancelling}
                isLoading={isCancelling}
                onClick={handleCancelOrder}
              >
                Xác nhận hủy
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
