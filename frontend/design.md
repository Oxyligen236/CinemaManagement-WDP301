# Design System & UI Specifications (Frontend)

> Tech stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4.  
> Chủ đạo: Đỏ (`#DC2626`) & Trắng (`#FFFFFF`), phong cách vận hành hiện đại, tương phản cao.

---

## 1. Tech Stack & Tích hợp Tailwind CSS v4

### 1.1. Cấu hình Theme (`app/globals.css`)

Khai báo token trực tiếp qua chỉ thị `@theme` của Tailwind v4:

```css
@import "tailwindcss";

@theme {
  /* Brand colors */
  --color-primary-700: #b91c1c;
  --color-primary-600: #dc2626;
  --color-primary-500: #ef4444;
  --color-primary-100: #fee2e2;
  --color-primary-50: #fef2f2;

  /* Surfaces & Neutrals */
  --color-bg-app: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f4f6;
  --color-text-main: #111827;
  --color-text-sub: #4b5563;
  --color-text-muted: #6b7280;
  --color-border-main: #e5e7eb;

  /* Status */
  --color-status-success: #15803d;
  --color-status-warning: #b45309;
  --color-status-danger: #b91c1c;
  --color-status-info: #0369a1;

  /* Radii & Shadows */
  --radius-card: 12px;
  --shadow-card: 0 1px 3px 0 rgb(15 23 42 / 0.08);

  /* Typography */
  --font-inter: var(--font-inter), sans-serif;
}
```

### 1.2. Typography & Font Loader (`app/layout.tsx`)

```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});
```

---

## 2. Design Tokens & Utility Classes

| Token         | Giá trị   | Tailwind Class                       | Mục đích sử dụng                       |
| ------------- | --------- | ------------------------------------ | -------------------------------------- |
| `primary-700` | `#B91C1C` | `bg-primary-700`, `text-primary-700` | Hover nút chính, cảnh báo nguy hiểm    |
| `primary-600` | `#DC2626` | `bg-primary-600`, `text-primary-600` | Nút hành động chính (CTA), link active |
| `primary-500` | `#EF4444` | `bg-primary-500`                     | Điểm nhấn biểu đồ, highlight           |
| `primary-100` | `#FEE2E2` | `bg-primary-100`                     | Nền menu đang chọn, badge đỏ nhạt      |
| `primary-50`  | `#FEF2F2` | `bg-primary-50`                      | Nền highlight card/vùng                |
| `bg-app`      | `#F8FAFC` | `bg-bg-app`                          | Nền toàn bộ trang quản trị             |
| `surface`     | `#FFFFFF` | `bg-surface`                         | Bề mặt card, modal, header             |
| `border-main` | `#E5E7EB` | `border-border-main`                 | Đường viền input, bảng, divider        |
| `success`     | `#15803D` | `text-status-success`                | Đã xác nhận / Hoạt động                |
| `warning`     | `#B45309` | `text-status-warning`                | Sắp diễn ra / Cần kiểm tra             |
| `danger`      | `#B91C1C` | `text-status-danger`                 | Thất bại / Lỗi / Hủy                   |
| `info`        | `#0369A1` | `text-status-info`                   | Thông tin trung tính                   |

---

## 3. Quy chuẩn Thành phần Giao diện (React Component Specs)

### 3.1. Button (`components/ui/Button.tsx`)

Chiều cao tiêu chuẩn: `h-10` (`40px`), bo góc `rounded-lg`.

- **Primary:** `bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600`
- **Secondary:** `bg-white text-text-main border border-border-main hover:bg-surface-muted`
- **Ghost:** `bg-transparent text-text-sub hover:bg-surface-muted`
- **Danger:** `bg-status-danger text-white hover:bg-red-800`
- **Loading:** Thêm spinner SVG, bật `disabled` và `cursor-not-allowed opacity-70`.

### 3.2. Form & Input

- Cấu trúc: Nhãn (`label`) phía trên, thông báo lỗi (`text-xs text-status-danger`) ngay dưới trường.
- Class input: `h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600`.
- Hỗ trợ `aria-invalid`, `aria-describedby` phục vụ accessibility.

### 3.3. Card & Metric Card

- Nền `bg-surface`, viền `border border-border-main`, bo góc `rounded-xl`, đổ bóng `shadow-card`.
- Padding tiêu chuẩn: `p-4 sm:p-6`.
- Card số liệu: Tiêu đề `text-sm font-medium text-text-sub`, giá trị `text-2xl font-bold text-text-main`, chỉ số so sánh `text-xs font-semibold text-status-success` hoặc `text-status-danger`.

### 3.4. Table & Data Grid

- Bọc ngoài: `overflow-x-auto rounded-xl border border-border-main bg-surface`.
- Header: `bg-surface-muted text-xs font-semibold uppercase tracking-wider text-text-sub text-left px-4 py-3`.
- Row: `border-b border-border-main hover:bg-slate-50 transition-colors text-sm text-text-main px-4 py-3.5`.
- Trạng thái: Luôn có khối rỗng (`EmptyState`), khối chờ (`TableSkeleton`), khối lỗi (`ErrorBanner`).

### 3.5. Badge trạng thái

Kèm icon hoặc chữ rõ ràng (không dùng màu đơn thuần):

- **Đang hoạt động / Xác nhận:** `bg-emerald-50 text-emerald-700 border border-emerald-200`
- **Bản nháp / Chưa xử lý:** `bg-slate-100 text-slate-700 border border-slate-200`
- **Sắp diễn ra / Chờ xử lý:** `bg-amber-50 text-amber-800 border border-amber-200`
- **Đã hủy / Lỗi:** `bg-red-50 text-red-700 border border-red-200`
- **Đang chiếu:** `bg-primary-100 text-primary-700 border border-primary-200`

### 3.6. Sơ đồ ghế (Seat Map)

Quy chuẩn trực quan theo grid:

- **Ghế trống:** `bg-white border-2 border-slate-300 text-slate-700 hover:border-primary-600`
- **Đang chọn:** `bg-primary-600 border-2 border-primary-600 text-white font-bold`
- **Đang giữ (người khác):** `bg-amber-100 border-2 border-amber-300 text-amber-800 cursor-not-allowed`
- **Đã bán:** `bg-slate-200 border-2 border-slate-300 text-slate-400 cursor-not-allowed`
- **Ghế VIP / Đôi:** Viền đậm hoặc badge phân biệt kích cỡ kèm chú giải (Legend).

---

## 4. Bố cục Quản trị (Admin App Router Layout)

```
app/
├── (admin)/
│   ├── layout.tsx         # Sidebar (240px) + Header (64px) + Main content
│   ├── dashboard/page.tsx # Tổng quan chỉ số
│   ├── movies/page.tsx    # Quản lý phim
│   ├── showtimes/page.tsx # Lịch / Suất chiếu
│   ├── rooms/page.tsx     # Rạp & Phòng chiếu
│   ├── seats/page.tsx     # Sơ đồ ghế
│   ├── orders/page.tsx    # Vé & Đơn hàng
│   ├── customers/page.tsx # Khách hàng
│   ├── promotions/page.tsx# Khuyến mãi
│   └── reports/page.tsx   # Báo cáo doanh thu
└── globals.css
```

- **Sidebar:** Cố định desktop `w-60` (`240px`), tự thu gọn trên tablet/mobile. Mục active: `bg-primary-100 text-primary-700 font-semibold border-r-4 border-primary-600`.
- **Header:** Chiều cao `h-16` (`64px`), cố định trên cùng, chứa breadcrumb, chuyển rạp, avatar người dùng.
- **Main:** `flex-1 bg-bg-app p-4 sm:p-6 lg:p-8 overflow-y-auto`.

---

## 5. Quy chuẩn Định dạng & Dữ liệu (`vi-VN`)

Sử dụng trực tiếp native JavaScript APIs:

```ts
// Tiền tệ VND
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount,
  );

// Ngày giờ
export const formatDateTime = (date: Date | string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(date));
```

---

## 6. Tiêu chí Kiểm thử UI (Verification Checklist)

- [ ] **Màu sắc & Tương phản:** Không dùng màu đơn thuần biểu đạt trạng thái; text đạt tỷ lệ tương phản tối thiểu 4.5:1.
- [ ] **Tương tác:** Nút submit có loading state, chặn double-click. Thao tác xóa/hủy mở dialog xác nhận.
- [ ] **Responsive:** Bảng hỗ trợ cuộn ngang (`overflow-x-auto`), form chia 1 cột trên mobile và 2-3 cột trên desktop.
- [ ] **Motion:** Thời lượng hiệu ứng `150ms–200ms`, tuân thủ `motion-reduce:transition-none`.
