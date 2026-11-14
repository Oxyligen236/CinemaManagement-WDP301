import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShieldCheck } from 'lucide-react';
import { AuthField } from '../auth/auth-field';
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AuthErrorBanner,
  AuthShell,
  AuthSuccessBanner,
} from '../auth/auth-shell';
import { OrderStatusBadge, TicketStatusBadge } from '../orders/OrderStatusBadge';
import { PromotionStatsCards } from '../admin/promotions/PromotionStatsCards';
import { PromotionFilterBar } from '../admin/promotions/PromotionFilterBar';
import { PromotionDeactivateDialog } from '../admin/promotions/PromotionDeactivateDialog';
import type { OrderStatus, TicketStatus } from '@/lib/types/order.types';
import type { Promotion } from '@/lib/types/promotion.types';

describe('components/auth/AuthField', () => {
  it('renders label, input attributes, hint, error, aria-describedby, and children', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();

    const { rerender } = render(
      <AuthField
        id="email"
        label="Email"
        value=""
        onChange={onChange}
        onBlur={onBlur}
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
        inputMode="email"
        maxLength={50}
        minLength={5}
        inputClassName="text-center"
      >
        <a href="/forgot-password">Quên mật khẩu?</a>
      </AuthField>,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).toHaveClass('text-center');
    expect(screen.getByText('Quên mật khẩu?')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'a@b.vn' } });
    expect(onChange).toHaveBeenCalledWith('a@b.vn');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);

    rerender(
      <AuthField
        id="email"
        label="Email"
        value="bad"
        onChange={onChange}
        required={false}
        hint="Dùng email công ty"
        error="Email không hợp lệ"
      />,
    );

    const errInput = screen.getByLabelText('Email');
    expect(errInput).not.toBeRequired();
    expect(errInput).toHaveAttribute('aria-invalid', 'true');
    expect(errInput).toHaveAttribute('aria-describedby', 'email-error email-hint');
    expect(screen.getByText('Email không hợp lệ')).toHaveAttribute('id', 'email-error');
    expect(screen.getByText('Dùng email công ty')).toHaveAttribute('id', 'email-hint');
  });
});

describe('components/auth/auth-shell', () => {
  it('exports auth style tokens, AuthErrorBanner, and AuthSuccessBanner', () => {
    expect(AUTH_INPUT_CLASS).toContain('h-[40px]');
    expect(AUTH_LABEL_CLASS).toContain('uppercase');
    expect(AUTH_PRIMARY_BUTTON_CLASS).toContain('bg-[#da291c]');
    expect(AUTH_SECONDARY_BUTTON_CLASS).toContain('bg-[#efebdb]');

    render(
      <>
        <AuthErrorBanner message="Sai mật khẩu" />
        <AuthSuccessBanner message="Đăng ký thành công" />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sai mật khẩu');
    expect(screen.getByRole('status')).toHaveTextContent('Đăng ký thành công');
  });

  it('renders AuthShell with optional and default slots', () => {
    const { rerender } = render(
      <AuthShell
        eyebrow="ĐĂNG NHẬP"
        title="Chào mừng trở lại"
        description="Vui lòng nhập thông tin"
        panelTitle="Tài khoản"
        panelAside="Bắt buộc"
        icon={ShieldCheck}
        maxWidthClass="max-w-[600px]"
        footerSlot={<div>Footer link slot</div>}
      >
        <form>Form body</form>
      </AuthShell>,
    );

    expect(screen.getByText(/LATTE CINEMA • ĐĂNG NHẬP/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập thông tin')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Bắt buộc')).toBeInTheDocument();
    expect(screen.getByText('Form body')).toBeInTheDocument();
    expect(screen.getByText('Footer link slot')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Về Trang chủ Latte Cinema/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('href', '/register');

    rerender(
      <AuthShell eyebrow="XÁC THỰC" title="OTP" panelTitle="Nhập mã">
        <div>OTP body</div>
      </AuthShell>,
    );
    expect(screen.getByText('OTP body')).toBeInTheDocument();
    expect(screen.queryByText('Footer link slot')).toBeNull();
  });
});

describe('components/orders/OrderStatusBadge & TicketStatusBadge', () => {
  it('renders Vietnamese labels for all known statuses and falls back for unknown', () => {
    const orderCases: Array<[OrderStatus, string]> = [
      ['PAID', 'Đã thanh toán'],
      ['PENDING', 'Chờ thanh toán'],
      ['CANCELLED', 'Đã hủy'],
      ['EXPIRED', 'Đã hết hạn'],
    ];

    for (const [status, label] of orderCases) {
      const { unmount } = render(
        <OrderStatusBadge status={status} className="ord-cls" />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
    render(<OrderStatusBadge status={'UNKNOWN' as OrderStatus} />);
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();

    const ticketCases: Array<[TicketStatus, string]> = [
      ['VALID', 'Chưa sử dụng'],
      ['USED', 'Đã soát vé'],
      ['CANCELLED', 'Đã hủy'],
      ['EXPIRED', 'Hết hạn'],
    ];
    for (const [status, label] of ticketCases) {
      const { unmount } = render(
        <TicketStatusBadge status={status} className="tkt-cls" />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
    render(<TicketStatusBadge status={'OTHER' as TicketStatus} />);
    expect(screen.getByText('OTHER')).toBeInTheDocument();
  });
});

describe('components/admin/promotions/PromotionStatsCards', () => {
  const stats = {
    total: 12,
    active: 7,
    inactive: 3,
    expired: 2,
    percentageCount: 8,
    fixedAmountCount: 4,
  };

  it('renders skeleton placeholders while loading and metric values when loaded', () => {
    const { container, rerender } = render(
      <PromotionStatsCards stats={stats} isLoading />,
    );
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
    expect(screen.queryByText('12')).toBeNull();

    rerender(<PromotionStatsCards stats={stats} isLoading={false} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('8 % / 4 ₫')).toBeInTheDocument();
  });
});

describe('components/admin/promotions/PromotionFilterBar', () => {
  it('handles search, discountType, isActive changes, create action, and conditional reset button', () => {
    const onSearchChange = vi.fn();
    const onDiscountTypeChange = vi.fn();
    const onIsActiveChange = vi.fn();
    const onOpenCreateModal = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <PromotionFilterBar
        search=""
        onSearchChange={onSearchChange}
        discountType={undefined}
        onDiscountTypeChange={onDiscountTypeChange}
        isActive={undefined}
        onIsActiveChange={onIsActiveChange}
        onOpenCreateModal={onOpenCreateModal}
        onReset={onReset}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Đặt lại bộ lọc' })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Tìm theo mã khuyến mãi...'), {
      target: { value: 'SALE50' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('SALE50');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'PERCENTAGE' } });
    expect(onDiscountTypeChange).toHaveBeenCalledWith('PERCENTAGE');
    fireEvent.change(selects[0], { target: { value: '' } });
    expect(onDiscountTypeChange).toHaveBeenCalledWith(undefined);

    fireEvent.change(selects[1], { target: { value: 'true' } });
    expect(onIsActiveChange).toHaveBeenCalledWith(true);
    fireEvent.change(selects[1], { target: { value: 'false' } });
    expect(onIsActiveChange).toHaveBeenCalledWith(false);
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(onIsActiveChange).toHaveBeenCalledWith(undefined);

    fireEvent.click(screen.getByRole('button', { name: /Tạo khuyến mãi mới/i }));
    expect(onOpenCreateModal).toHaveBeenCalledTimes(1);

    rerender(
      <PromotionFilterBar
        search="VIP"
        onSearchChange={onSearchChange}
        discountType={undefined}
        onDiscountTypeChange={onDiscountTypeChange}
        isActive={true}
        onIsActiveChange={onIsActiveChange}
        onOpenCreateModal={onOpenCreateModal}
        onReset={onReset}
      />,
    );
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('true');

    rerender(
      <PromotionFilterBar
        search=""
        onSearchChange={onSearchChange}
        discountType="FIXED_AMOUNT"
        onDiscountTypeChange={onDiscountTypeChange}
        isActive={false}
        onIsActiveChange={onIsActiveChange}
        onOpenCreateModal={onOpenCreateModal}
        onReset={onReset}
      />,
    );

    const resetBtn = screen.getByRole('button', { name: 'Đặt lại bộ lọc' });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('components/admin/promotions/PromotionDeactivateDialog', () => {
  const activePromo: Promotion = {
    promotionId: 'p1',
    promotionCode: 'LATTE20',
    discountValue: 20,
    discountType: 'PERCENTAGE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('returns null when promotion is null', () => {
    const { container } = render(
      <PromotionDeactivateDialog
        isOpen
        onClose={vi.fn()}
        promotion={null}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('confirms deactivation, invokes onConfirm(id, false) and closes on success', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <PromotionDeactivateDialog
        isOpen
        onClose={onClose}
        promotion={activePromo}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Xác nhận vô hiệu hóa mã')).toBeInTheDocument();
    expect(screen.getByText('LATTE20')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa ngay' }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('p1', false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('confirms reactivation and handles rejected onConfirm without closing', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'));

    render(
      <PromotionDeactivateDialog
        isOpen
        onClose={onClose}
        promotion={{ ...activePromo, isActive: false }}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Xác nhận kích hoạt mã')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Kích hoạt' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('p1', true);
      expect(confirmBtn).not.toBeDisabled();
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
