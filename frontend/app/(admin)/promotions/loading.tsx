import React from 'react';
import { TableSkeleton } from '../../../components/ui/TableSkeleton';

export default function PromotionsLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg" />
          <div className="h-4 w-96 bg-slate-100 animate-pulse rounded mt-2" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl border border-border-main p-4 sm:p-6 shadow-card animate-pulse space-y-4"
          >
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-8 w-16 bg-slate-300 rounded" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-surface rounded-xl border border-border-main p-4 shadow-card animate-pulse flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-3 flex-1">
          <div className="h-10 w-64 bg-slate-200 rounded-lg" />
          <div className="h-10 w-40 bg-slate-100 rounded-lg" />
          <div className="h-10 w-40 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
