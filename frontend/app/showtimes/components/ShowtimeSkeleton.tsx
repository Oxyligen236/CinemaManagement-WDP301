'use client';

import React from 'react';

export function ShowtimeSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Skeleton Cho Dropdown Rạp */}
      <div className="w-full bg-surface border border-border-main rounded-xl p-4 sm:p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-200" />
            <div className="space-y-1.5">
              <div className="w-48 h-3.5 bg-slate-200 rounded" />
              <div className="w-64 h-3 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="w-full sm:w-80 h-11 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Skeleton Cho Thanh Tab Ngày */}
      <div className="w-full bg-surface border border-border-main rounded-xl p-3 shadow-card">
        <div className="flex items-center gap-2">
          <div className="h-16 w-8 bg-slate-100 rounded-lg shrink-0" />
          <div className="flex-1 flex gap-2 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[76px] h-16 bg-slate-100 rounded-lg shrink-0 flex flex-col items-center justify-center p-2 space-y-1.5"
              >
                <div className="w-10 h-2.5 bg-slate-200 rounded" />
                <div className="w-8 h-4 bg-slate-200 rounded" />
                <div className="w-10 h-2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-16 w-8 bg-slate-100 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Skeleton Cho Danh Sách Phim (2 Cards) */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="w-full bg-surface border border-border-main rounded-xl p-4 sm:p-6 shadow-card"
          >
            <div className="flex flex-col md:flex-row gap-5 lg:gap-6">
              {/* Poster Skeleton */}
              <div className="flex md:flex-col gap-4 md:w-44 shrink-0">
                <div className="w-28 h-40 md:w-full md:h-64 bg-slate-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-slate-200 rounded" />
                  <div className="w-20 h-3 bg-slate-100 rounded" />
                  <div className="w-24 h-3 bg-slate-100 rounded" />
                </div>
              </div>

              {/* Slots Skeleton */}
              <div className="flex-1 border-t md:border-t-0 md:border-l border-border-main pt-4 md:pt-0 md:pl-6 space-y-4">
                <div className="w-36 h-4 bg-slate-200 rounded" />
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="w-28 h-12 bg-slate-100 rounded-lg" />
                  ))}
                </div>
                <div className="w-40 h-4 bg-slate-200 rounded pt-2" />
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="w-28 h-12 bg-slate-100 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
