import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StaffOrdersPage from '../page';
import { orderApi } from '@/lib/api/order.api';
import type { OrderSummary } from '@/lib/types/order.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/orders',
}));

vi.mock('@/lib/api/order.api', () => ({
  orderApi: {
    getStaffOrders: vi.fn(),
    getOrderDetail: vi.fn(),
    cancelStaffOrder: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-staff-status', () => ({
  useStaffStatus: () => ({
    staffUser: {
      id: 'staff-1',
      branchId: 'branch-tay-ho',
      branchName: 'Latte Cinema Tây Hồ',
      role: 'STAFF',
    },
    branchInfo: {
      branchId: 'branch-tay-ho',
      branchName: 'Latte Cinema Tây Hồ',
      address: '272 Võ Chí Công, Tây Hồ',
      hotline: '024 3333 6000',
    },
    currentShift: null,
    shiftStatus: { text: 'Đang trực', colorClass: 'text-green-600', isOpen: true },
    loading: false,
  }),
}));

describe('StaffOrdersPage', () => {
  const mockOrders: OrderSummary[] = [
    {
      orderId: 'ord-cantavil-1',
      userId: 'u1',
      totalAmount: 150000,
      status: 'PAID',
      createdAt: '2026-11-15T10:00:00Z',
      ticketCount: 2,
      hasProducts: false,
      branchId: 'branch-cantavil',
      branchName: 'Latte Cinema Cantavil',
    },
    {
      orderId: 'ord-tay-ho-1',
      userId: 'u2',
      totalAmount: 200000,
      status: 'PAID',
      createdAt: '2026-11-15T10:30:00Z',
      ticketCount: 2,
      hasProducts: true,
      branchId: 'branch-tay-ho',
      branchName: 'Latte Cinema Tây Hồ',
    },
    {
      orderId: 'ord-landmark-1',
      userId: 'u3',
      totalAmount: 120000,
      status: 'PAID',
      createdAt: '2026-11-15T11:00:00Z',
      ticketCount: 1,
      hasProducts: false,
      branchId: 'branch-landmark',
      branchName: 'Latte Cinema Landmark',
    },
    {
      orderId: 'ord-tay-ho-2',
      userId: 'u4',
      totalAmount: 90000,
      status: 'PENDING',
      createdAt: '2026-11-15T11:15:00Z',
      ticketCount: 1,
      hasProducts: false,
      branchId: 'branch-tay-ho',
      branchName: 'Latte Cinema Tây Hồ',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      'cinema_user',
      JSON.stringify({
        id: 'staff-1',
        branchId: 'branch-tay-ho',
        branchName: 'Latte Cinema Tây Hồ',
        role: 'STAFF',
      }),
    );
  });

  it('filters out orders from other branches and only renders orders belonging to the staff branch', async () => {
    vi.mocked(orderApi.getStaffOrders).mockResolvedValue({
      items: mockOrders,
      total: mockOrders.length,
      page: 1,
      limit: 200,
      totalPages: 1,
    });

    render(<StaffOrdersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('#ORD-TAY-')).toHaveLength(2);
    });

    // Orders from other branches must NOT be displayed
    expect(screen.queryByText('#ORD-CANT')).not.toBeInTheDocument();
    expect(screen.queryByText('#ORD-LAND')).not.toBeInTheDocument();
    expect(screen.queryByText('Latte Cinema Cantavil')).not.toBeInTheDocument();
    expect(screen.queryByText('Latte Cinema Landmark')).not.toBeInTheDocument();

    // Only Latte Cinema Tây Hồ orders are displayed
    const tayHoCells = screen.getAllByText('Latte Cinema Tây Hồ');
    expect(tayHoCells.length).toBeGreaterThanOrEqual(2);

    // Verify exactly 2 order rows rendered in table tbody
    const rows = screen.getAllByText(/#ORD-TAY-/);
    expect(rows).toHaveLength(2);
  });

  it('paginates filtered orders when count exceeds page size', async () => {
    const manyOrders: OrderSummary[] = Array.from({ length: 15 }).map((_, idx) => ({
      orderId: `ord-tayho-${idx + 1}`,
      userId: `u-${idx}`,
      totalAmount: 100000,
      status: 'PAID',
      createdAt: '2026-11-15T10:00:00Z',
      ticketCount: 1,
      hasProducts: false,
      branchId: 'branch-tay-ho',
      branchName: 'Latte Cinema Tây Hồ',
    }));

    vi.mocked(orderApi.getStaffOrders).mockResolvedValue({
      items: manyOrders,
      total: manyOrders.length,
      page: 1,
      limit: 200,
      totalPages: 1,
    });

    render(<StaffOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Tổng cộng 15 đơn/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Hiển thị trang/)).toBeInTheDocument();
  });
});
