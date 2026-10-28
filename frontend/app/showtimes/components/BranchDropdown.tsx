'use client';

import React, { useEffect } from 'react';
import { MapPin, ChevronDown, Building2 } from 'lucide-react';
import type { PublicBranch } from '@/lib/api/showtimes-public.api';

interface BranchDropdownProps {
  branches: PublicBranch[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  loading?: boolean;
}

const STORAGE_KEY = 'last_selected_branch_id';

export function BranchDropdown({
  branches,
  selectedBranchId,
  onSelectBranch,
  loading = false,
}: BranchDropdownProps) {
  // Khôi phục chi nhánh đã lưu trước đó nếu chưa có lựa chọn
  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      try {
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId && branches.some((b) => b.branchId === savedId)) {
          onSelectBranch(savedId);
          return;
        }
      } catch {
        // bỏ qua nếu localStorage không khả dụng
      }
    }
  }, [branches, selectedBranchId, onSelectBranch]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onSelectBranch(val);
    try {
      if (val) {
        localStorage.setItem(STORAGE_KEY, val);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage error handler
    }
  };

  const selectedBranch = branches.find((b) => b.branchId === selectedBranchId);

  return (
    <div className="w-full bg-surface border border-border-main rounded-xl p-4 sm:p-5 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <label
              htmlFor="branch-select"
              className="block text-xs font-semibold text-text-sub uppercase tracking-wider"
            >
              Chọn cụm rạp chiếu Lotte Cinema
            </label>
            <p className="text-xs text-text-muted mt-0.5">
              Xem lịch chiếu và đặt vé nhanh tại chi nhánh gần bạn nhất
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-80 md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
            <MapPin className="w-4 h-4 text-primary-600" />
          </div>
          <select
            id="branch-select"
            value={selectedBranchId}
            onChange={handleChange}
            disabled={loading || branches.length === 0}
            className="w-full h-11 pl-9 pr-10 text-sm font-medium text-text-main bg-white border border-border-main rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600 transition-colors disabled:bg-surface-muted disabled:cursor-not-allowed"
          >
            <option value="">--- Chọn rạp chiếu Lotte Cinema ---</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.branchName}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {selectedBranch && (
        <div className="mt-3.5 pt-3 border-t border-border-main flex flex-wrap items-center justify-between gap-2 text-xs text-text-sub">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-text-main">
              {selectedBranch.branchName}:
            </span>
            <span className="text-text-muted">{selectedBranch.address}</span>
          </div>
          {selectedBranch.hotline && (
            <div className="flex items-center gap-1 text-primary-600 font-medium">
              <span>Hotline:</span>
              <span>{selectedBranch.hotline}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
