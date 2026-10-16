import React from 'react';

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols = 6 }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-main bg-surface animate-pulse">
      <div className="bg-surface-muted h-10 border-b border-border-main flex items-center px-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`th-${i}`} className="h-4 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border-main">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex items-center px-4 py-4 gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={`td-${r}-${c}`} className="h-4 bg-slate-100 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
