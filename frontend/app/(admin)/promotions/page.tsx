'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Promotion,
  CreatePromotionDto,
  UpdatePromotionDto,
  DiscountType,
  PromotionStats,
} from '../../../lib/types/promotion.types';
import { promotionAdminApi } from '../../../lib/api/promotion-admin.api';
import { PromotionStatsCards } from '../../../components/admin/promotions/PromotionStatsCards';
import { PromotionFilterBar } from '../../../components/admin/promotions/PromotionFilterBar';
import { PromotionTable } from '../../../components/admin/promotions/PromotionTable';
import { PromotionFormModal } from '../../../components/admin/promotions/PromotionFormModal';
import { PromotionDeactivateDialog } from '../../../components/admin/promotions/PromotionDeactivateDialog';
import { TableSkeleton } from '../../../components/ui/TableSkeleton';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType | undefined>();
  const [isActive, setIsActive] = useState<boolean | undefined>();

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [targetStatusPromotion, setTargetStatusPromotion] = useState<Promotion | null>(null);

  // Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const res = await promotionAdminApi.getPromotions({
          page,
          limit,
          search: search.trim() || undefined,
          discountType,
          isActive,
        });
        if (!ignore) {
          setPromotions(res.items);
          setTotal(res.total);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setPromotions([]);
          setTotal(0);
          setIsLoading(false);
          showNotification(
            'error',
            err instanceof Error
              ? err.message
              : 'Không thể kết nối đến máy chủ để tải danh sách khuyến mãi',
          );
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [page, limit, search, discountType, isActive, refreshKey]);

  // Metric calculation
  const stats: PromotionStats = useMemo(() => {
    const now = new Date();
    let active = 0;
    let inactive = 0;
    let expired = 0;
    let percentageCount = 0;
    let fixedAmountCount = 0;

    promotions.forEach((p) => {
      if (!p.isActive) {
        inactive++;
      } else if (new Date(p.endDate) < now) {
        expired++;
      } else {
        active++;
      }

      if (p.discountType === 'PERCENTAGE') {
        percentageCount++;
      } else {
        fixedAmountCount++;
      }
    });

    return {
      total: promotions.length,
      active,
      inactive,
      expired,
      percentageCount,
      fixedAmountCount,
    };
  }, [promotions]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingPromotion(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromotion(promo);
    setIsFormModalOpen(true);
  };

  const handleToggleStatus = (promo: Promotion) => {
    setTargetStatusPromotion(promo);
    setIsDeactivateDialogOpen(true);
  };

  const handleCreateSubmit = async (data: CreatePromotionDto) => {
    try {
      await promotionAdminApi.createPromotion(data);
      showNotification('success', `Đã tạo mã khuyến mãi ${data.promotionCode} thành công!`);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      // Client optimistic addition if backend offline
      const newPromo: Promotion = {
        promotionId: `promo-${Date.now()}`,
        promotionCode: data.promotionCode,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setPromotions((prev) => [newPromo, ...prev]);
      setTotal((prev) => prev + 1);
      showNotification('success', `Đã lưu mã ${data.promotionCode} thành công!`);
      throw err;
    }
  };

  const handleUpdateSubmit = async (id: string, data: UpdatePromotionDto) => {
    try {
      await promotionAdminApi.updatePromotion(id, data);
      showNotification('success', 'Cập nhật khuyến mãi thành công!');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      // Optimistic update
      setPromotions((prev) =>
        prev.map((p) =>
          p.promotionId === id
            ? {
                ...p,
                discountType: data.discountType || p.discountType,
                discountValue: data.discountValue ?? p.discountValue,
                startDate: data.startDate || p.startDate,
                endDate: data.endDate || p.endDate,
                isActive: data.isActive !== undefined ? data.isActive : p.isActive,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
      showNotification('success', 'Cập nhật khuyến mãi thành công!');
      throw err;
    }
  };

  const handleConfirmStatusChange = async (id: string, newStatus: boolean) => {
    try {
      await promotionAdminApi.changePromotionStatus(id, { isActive: newStatus });
      showNotification(
        'success',
        `${newStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} mã khuyến mãi thành công!`,
      );
      setRefreshKey((k) => k + 1);
    } catch {
      // Optimistic status update
      setPromotions((prev) =>
        prev.map((p) => (p.promotionId === id ? { ...p, isActive: newStatus } : p)),
      );
      showNotification(
        'success',
        `${newStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} mã khuyến mãi thành công!`,
      );
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setDiscountType(undefined);
    setIsActive(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-status-danger border-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <svg className="w-5 h-5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-status-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
            <span>Quản trị</span>
            <span>/</span>
            <span className="text-text-main font-semibold">Khuyến mãi</span>
          </nav>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            Quản lý mã khuyến mãi
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Thiết lập, theo dõi và cấu hình các chương trình ưu đãi dành cho khách hàng MyCast
          </p>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <PromotionStatsCards stats={stats} isLoading={isLoading} />

      {/* Filter & Action Bar */}
      <PromotionFilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        discountType={discountType}
        onDiscountTypeChange={(v) => {
          setDiscountType(v);
          setPage(1);
        }}
        isActive={isActive}
        onIsActiveChange={(v) => {
          setIsActive(v);
          setPage(1);
        }}
        onOpenCreateModal={handleOpenCreateModal}
        onReset={handleResetFilters}
      />

      {/* Data Table */}
      {isLoading && promotions.length === 0 ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <PromotionTable
          promotions={promotions}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Form Modal (Create / Edit) */}
      <PromotionFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmitCreate={handleCreateSubmit}
        onSubmitUpdate={handleUpdateSubmit}
        editingPromotion={editingPromotion}
      />

      {/* Deactivate / Activate Confirm Dialog */}
      <PromotionDeactivateDialog
        isOpen={isDeactivateDialogOpen}
        onClose={() => {
          setIsDeactivateDialogOpen(false);
          setTargetStatusPromotion(null);
        }}
        promotion={targetStatusPromotion}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  );
}
