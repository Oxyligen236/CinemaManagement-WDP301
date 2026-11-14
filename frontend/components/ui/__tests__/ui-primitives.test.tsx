import React, { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Badge, BadgeVariant } from '../Badge';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { SafeImage } from '../safe-image';
import { TableSkeleton } from '../TableSkeleton';

describe('components/ui/Badge', () => {
  it('renders children, optional icon, custom className, and all variants', () => {
    const variants: BadgeVariant[] = [
      'success',
      'warning',
      'danger',
      'info',
      'draft',
      'primary',
    ];

    const { rerender } = render(<Badge>Mặc định</Badge>);
    expect(screen.getByText('Mặc định').parentElement).toHaveClass('bg-slate-100');

    for (const variant of variants) {
      rerender(
        <Badge
          variant={variant}
          icon={<span data-testid="badge-icon">*</span>}
          className="extra-cls"
        >
          {variant}
        </Badge>,
      );
      expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
      expect(screen.getByText(variant).parentElement).toHaveClass('extra-cls');
    }
  });
});

describe('components/ui/Button', () => {
  it('renders variants, sizes, icons, ref, and handles click', () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
    const sizes: ButtonSize[] = ['sm', 'md', 'lg'];

    const { rerender } = render(
      <Button
        ref={ref}
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
        onClick={onClick}
        className="custom-btn"
      >
        Lưu
      </Button>,
    );

    const btn = screen.getByRole('button', { name: /Lưu/i });
    expect(ref.current).toBe(btn);
    expect(btn).toHaveClass('custom-btn');
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    for (const variant of variants) {
      for (const size of sizes) {
        rerender(
          <Button variant={variant} size={size}>
            Btn
          </Button>,
        );
        expect(screen.getByRole('button')).toBeInTheDocument();
      }
    }
  });

  it('shows spinner, hides icons, and disables click when isLoading or disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button
        isLoading
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
        onClick={onClick}
      >
        Đang gửi
      </Button>,
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('opacity-70');
    expect(btn.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByTestId('left')).toBeNull();
    expect(screen.queryByTestId('right')).toBeNull();

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button disabled onClick={onClick}>
        Bị khóa
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed');
  });
});

describe('components/ui/Input', () => {
  it('renders label, required asterisk, helperText, ref, and generated id', () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <Input
        ref={ref}
        label="Email"
        required
        helperText="Nhập email hợp lệ"
        containerClassName="wrap-cls"
        className="inp-cls"
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText(/Email/i);
    expect(ref.current).toBe(input);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAttribute('aria-describedby', `${input.id}-helper`);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Nhập email hợp lệ')).toBeInTheDocument();
    expect(input.parentElement).toHaveClass('wrap-cls');
    expect(input).toHaveClass('inp-cls');

    fireEvent.change(input, { target: { value: 'a@b.com' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders error alert over helperText and supports explicit id without label', () => {
    const { rerender } = render(
      <Input
        id="phone"
        label="Số điện thoại"
        error="Sai định dạng"
        helperText="Không hiện khi có lỗi"
      />,
    );

    const input = screen.getByLabelText('Số điện thoại');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'phone-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Sai định dạng');
    expect(screen.queryByText('Không hiện khi có lỗi')).toBeNull();

    rerender(<Input id="bare" placeholder="Nhập nhanh" />);
    const bare = screen.getByPlaceholderText('Nhập nhanh');
    expect(bare).not.toHaveAttribute('aria-describedby');
  });
});

describe('components/ui/Modal', () => {
  it('renders nothing when closed and ignores Escape key', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={false} onClose={onClose} title="Tiêu đề">
        Nội dung
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('manages body overflow, accessibility attributes, maxWidth, and close triggers', () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(
      <Modal
        isOpen
        onClose={onClose}
        title="Xác nhận"
        description="Mô tả chi tiết"
        footer={<button type="button">OK</button>}
        maxWidth="2xl"
      >
        <div>Body text</div>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe('hidden');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Mô tả chi tiết')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();

    // Backdrop click closes
    const backdrop = dialog.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close button click closes
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Non-Escape key does not close; Escape closes
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    // Optional title/description/footer omitted + default maxWidth
    rerender(
      <Modal isOpen onClose={onClose}>
        <span>Minimal</span>
      </Modal>,
    );
    const minimalDialog = screen.getByRole('dialog');
    expect(minimalDialog).not.toHaveAttribute('aria-labelledby');
    expect(minimalDialog).not.toHaveAttribute('aria-describedby');

    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });
});

describe('components/ui/SafeImage', () => {
  it('renders external URL unoptimized and switches to escaped SVG fallback on error', () => {
    const onError = vi.fn();
    render(
      <SafeImage
        src="https://cdn.example.com/poster.jpg"
        alt={'Phim "A & B" <2026>'}
        width={200}
        height={300}
        onError={onError}
      />,
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/poster.jpg');

    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
    const fallbackSrc = img.getAttribute('src') ?? '';
    expect(fallbackSrc.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const decoded = decodeURIComponent(fallbackSrc);
    expect(decoded).toContain('&quot;A &amp; B&quot; &lt;2026&gt;');

    // Second error keeps fallback without breaking and still invokes prop onError
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('handles local src, string/omitted dimensions with fill, and empty/non-string alt fallback label', () => {
    const { rerender } = render(
      <SafeImage
        src="/local-poster.png"
        alt=""
        width={'120' as unknown as number}
        height={'180' as unknown as number}
      />,
    );

    const localImg = screen.getByAltText('');
    expect(localImg.getAttribute('src')).toContain('_next/image');
    fireEvent.error(localImg);
    expect(decodeURIComponent(localImg.getAttribute('src') ?? '')).toContain(
      'LATTE CINEMA',
    );

    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rerender(
      <SafeImage
        key="fill-img"
        src="/fill.png"
        alt={undefined as unknown as string}
        fill
      />,
    );
    consoleErrSpy.mockRestore();
    const fillImg = screen.getByRole('img');
    fireEvent.error(fillImg);
    const decodedFill = decodeURIComponent(fillImg.getAttribute('src') ?? '');
    expect(decodedFill).toContain('width="300"');
    expect(decodedFill).toContain('height="150"');
    expect(decodedFill).toContain('LATTE CINEMA');
  });
});

describe('components/ui/TableSkeleton', () => {
  it('renders default 5 rows and 6 cols and respects custom rows/cols', () => {
    const { container, rerender } = render(<TableSkeleton />);
    const root = container.firstElementChild as HTMLElement;
    const headerCols = root.children[0].children;
    const bodyRows = root.children[1].children;
    expect(headerCols).toHaveLength(6);
    expect(bodyRows).toHaveLength(5);
    expect(bodyRows[0].children).toHaveLength(6);

    rerender(<TableSkeleton rows={2} cols={3} />);
    const updated = container.firstElementChild as HTMLElement;
    expect(updated.children[0].children).toHaveLength(3);
    expect(updated.children[1].children).toHaveLength(2);
    expect(updated.children[1].children[0].children).toHaveLength(3);
  });
});
