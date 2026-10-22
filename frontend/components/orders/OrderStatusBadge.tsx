import React from 'react';
import { OrderStatus, TicketStatus } from '@/lib/types/order.types';
import { Badge, BadgeVariant } from '@/components/ui/Badge';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, className = '' }) => {
  const config: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
    PAID: { label: 'Đã thanh toán', variant: 'success' },
    PENDING: { label: 'Chờ thanh toán', variant: 'warning' },
    CANCELLED: { label: 'Đã hủy', variant: 'danger' },
    EXPIRED: { label: 'Đã hết hạn', variant: 'draft' },
  };

  const current = config[status] || { label: status, variant: 'draft' };

  return (
    <Badge variant={current.variant} className={className}>
      {current.label}
    </Badge>
  );
};

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export const TicketStatusBadge: React.FC<TicketStatusBadgeProps> = ({ status, className = '' }) => {
  const config: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
    VALID: { label: 'Chưa sử dụng', variant: 'success' },
    USED: { label: 'Đã soát vé', variant: 'info' },
    CANCELLED: { label: 'Đã hủy', variant: 'danger' },
    EXPIRED: { label: 'Hết hạn', variant: 'draft' },
  };

  const current = config[status] || { label: status, variant: 'draft' };

  return (
    <Badge variant={current.variant} className={className}>
      {current.label}
    </Badge>
  );
};
