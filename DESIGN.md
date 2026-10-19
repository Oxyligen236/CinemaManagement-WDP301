# CINEMA MANAGEMENT - DESIGN SYSTEM & UI GUIDELINES (`DESIGN.md`)

Tài liệu này định nghĩa ngôn ngữ thiết kế chung (Design System) cho toàn bộ hệ thống rạp chiếu phim WDP301. Tất cả các màn hình (Khách hàng, Nhân viên, Quản lý chi nhánh, Quản trị viên) phải tuân thủ nghiêm ngặt các quy tắc dưới đây nhằm đảm bảo tính đồng nhất, chuyên nghiệp và trải nghiệm người dùng tối ưu.

---

## 1. Bản sắc thị giác & Bảng màu chủ đạo (Color Palette)

Hệ thống lấy cảm hứng từ nhận diện rạp chiếu phim thương mại hiện đại (Cinema Identity):

| Tên màu | Mã màu (HEX / Tailwind) | Ứng dụng |
| :--- | :--- | :--- |
| **Primary Brand (Đỏ thương hiệu)** | `#da291c` / `rgb(218, 41, 28)` | Nút hành động chính (CTA: Đặt vé, Mua vé, Xác nhận), Logo điểm nhấn, tab đang chọn, viền highlight. |
| **Primary Hover** | `#b81d12` | Trạng thái hover của nút chính. |
| **Dark Header / GNB** | `#1a1a1a` & `#222222` | Thanh điều hướng (Header/GNB), Footer, thanh menu bar, nền màn hình phòng chiếu. |
| **Background (Sáng)** | `#ffffff` / `#f8fafc` (slate-50) | Nền chính trang khách hàng và trang bảng điều khiển Admin/Dashboard. |
| **Background (Tối/Rạp)** | `#111827` (gray-900) / `#0f172a` | Nền màn hình chọn ghế trong rạp, chế độ Dark Mode xem phim. |
| **Text Primary (Chữ chính)** | `#111827` / `#1f2937` | Tiêu đề lớn (Headings), tên phim, giá tiền. |
| **Text Body (Chữ nội dung)** | `#555555` / `#4b5563` | Nội dung mô tả, văn bản thông thường. |
| **Text Muted (Chữ phụ)** | `#888888` / `#9ca3af` | Thông tin phụ (thời lượng, đạo diễn, ngày chiếu, placeholder). |
| **Border / Divider** | `#e5e7eb` / `#e2e8f0` | Đường kẻ phân cách, viền card, viền input form. |

### Màu trạng thái & Phân loại ghế (State & Seat Status):
* **Ghế Thường (Standard Seat):** Viền xám nhạt `#cbd5e1`, nền trắng `#ffffff`, chữ `#475569`.
* **Ghế VIP (VIP Seat):** Viền cam hổ phách `#f59e0b`, nền vàng nhạt `#fef3c7`, chữ `#b45309`.
* **Ghế Đôi / Sweetbox (Couple Seat):** Nền hồng tím `#f43f5e`, chữ trắng `#ffffff`.
* **Ghế Đang Chọn (Selected Seat):** Nền đỏ thương hiệu `#da291c` hoặc xanh lá `#10b981`, chữ trắng.
* **Ghế Đã Bán / Khóa (Sold / Occupied):** Nền xám `#94a3b8`, icon dấu gạch chéo hoặc mờ, `cursor-not-allowed`.
* **Huy hiệu độ tuổi (Age Badges):**
  * `P` (Mọi lứa tuổi): `#10b981` (Xanh lá)
  * `C13` (13+): `#f59e0b` (Vàng cam)
  * `C16` (16+): `#f97316` (Cam đậm)
  * `C18` (18+): `#da291c` (Đỏ cờ)

---

## 2. Kiểu chữ & Cỡ chữ (Typography)

* **Font chữ hệ thống:** `Arial`, `Inter`, `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
* **Quy chuẩn Heading & Hierarchy:**
  * **H1 (Hero Title / Tên phim lớn):** `text-3xl sm:text-4xl font-bold tracking-tight text-slate-900` (30px – 36px).
  * **H2 (Section Header / Tiêu đề khối):** `text-2xl font-bold uppercase tracking-wider text-slate-900 border-b-2 border-[#da291c] pb-2 inline-block` (24px).
  * **H3 (Card Title / Tên cụm rạp):** `text-lg font-semibold text-slate-800` (18px).
  * **Body (Nội dung chính):** `text-sm sm:text-base text-slate-600 leading-relaxed` (14px – 16px).
  * **Caption / Small (Metadata, ngày giờ, số ghế):** `text-xs text-slate-500` (12px).

---

## 3. Quy chuẩn Thành phần Giao diện (Component Specifications)

### 3.1. Nút bấm (Buttons)
* **Primary Button (Kêu gọi hành động chính):**
  ```html
  <button class="bg-[#da291c] hover:bg-[#b81d12] text-white font-semibold py-2.5 px-6 rounded-xl shadow-md transition duration-200">
    Đặt vé ngay
  </button>
  ```
* **Secondary / Outline Button:**
  ```html
  <button class="border border-slate-300 hover:border-[#da291c] text-slate-700 hover:text-[#da291c] font-medium py-2 px-5 rounded-xl transition duration-200">
    Chi tiết phim
  </button>
  ```
* **Ghost / Icon Button:**
  ```html
  <button class="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
    <!-- Icon SVG -->
  </button>
  ```

### 3.2. Thẻ hiển thị phim (Movie Card)
* **Tỉ lệ ảnh poster:** Luôn dùng tỉ lệ `2:3` hoặc `aspect-[2/3]` với `object-cover`.
* **Bố cục card:**
  * Góc trên: Huy hiệu độ tuổi (`P`, `13+`, `16+`, `18+`).
  * Ảnh poster có hiệu ứng hover: `hover:scale-105 transition-transform duration-300`.
  * Lớp phủ (Overlay) khi hover: Nút "Đặt vé" và "Trailer" xuất hiện mờ dần (`opacity-0 group-hover:opacity-100 transition-opacity`).
  * Phần thân dưới: Tên phim (`font-bold truncate`), thể loại, thời lượng (ví dụ: `120 phút`).

### 3.3. Form nhập liệu (Inputs & Forms)
* Input fields: `rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-[#da291c] focus:ring-4 focus:ring-red-100`.
* Thông báo lỗi: Viền đỏ `#ef4444`, nền đỏ nhạt `#fef2f2`, chữ đỏ `#b91c1c`.

### 3.4. Layout & Container
* **Max Width Wrapper:** Khung trang luôn bọc trong container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
* **Khoảng cách giữa các khối (Section Spacing):** `py-10 sm:py-16` (cách nhau 40px – 64px).

---

## 4. Khuôn mẫu các màn hình chức năng trong dự án

### 4.1. Màn hình Khách hàng (Client Screens)
1. **Trang chủ (`/`):**
   * Top Header (Logo rạp, Tìm kiếm, Đăng nhập / Đăng ký / Thông tin User).
   * Hero Banner Carousel (Key visual các phim bom tấn đang chiếu).
   * Danh sách phim đang chiếu & Sắp chiếu dạng Carousel/Grid tab.
   * Danh sách sự kiện & Khuyến mãi rạp (Combo bắp nước, ưu đãi thành viên).
   * Footer chuẩn rạp (Thông tin pháp lý, hotline, liên hệ).
2. **Chi tiết phim (`/movies/[id]`):**
   * Banner nền mờ lớn (Backdrop), poster phim, thông tin đạo diễn, diễn viên, tóm tắt nội dung.
   * Trình chiếu Trailer dạng Modal Popup.
   * Bộ lọc lịch chiếu theo: Chi nhánh rạp (`branchId`) -> Ngày chiếu -> Suất chiếu (giờ).
3. **Màn hình Chọn ghế & Đặt vé (`/booking/[showtimeId]`):**
   * Thanh tiến trình 4 bước: `1. Chọn ghế -> 2. Chọn bắp nước -> 3. Thanh toán -> 4. Nhận vé`.
   * Màn hình chiếu tượng trưng (Screen Bar).
   * Ma trận sơ đồ ghế (Seat Matrix) hiển thị màu sắc theo trạng thái thời gian thực.
   * Đồng hồ đếm ngược giữ ghế (ví dụ: 10:00 phút).
   * Thanh tóm tắt giá vé cố định dưới đáy màn hình (Ghế đã chọn, Tổng tiền, Nút "Tiếp tục").
4. **Màn hình Combo Bắp nước (`/booking/concessions`):**
   * Danh sách combo bắp + nước kèm nút tăng/giảm số lượng (`+`, `-`).
5. **Màn hình Thanh toán (`/booking/checkout`):**
   * Tóm tắt chi tiết đơn hàng (Phim, Rạp, Suất chiếu, Ghế, Combo).
   * Phương thức thanh toán (VNPAY, MoMo, Thẻ ngân hàng).
6. **Màn hình Vé điện tử (`/booking/success`):**
   * Mã đặt vé, mã QR Code check-in tại cửa rạp, hướng dẫn nhận vé.

### 4.2. Màn hình Quản trị & Nhân viên (Admin / Manager / Staff Screens)
1. **Bố cục chung (Admin Layout):**
   * Sidebar cố định bên trái (Logo, Phim, Lịch chiếu, Phòng chiếu, Rạp chi nhánh, Đơn vé, Doanh thu, Nhân viên).
   * Topbar (Thông tin tài khoản, Chi nhánh quản lý hiện tại, Nút đăng xuất).
   * Nội dung chính: Thẻ thống kê (Metric Cards), Bảng dữ liệu (Data Table) kèm phân trang, tìm kiếm và bộ lọc.
2. **Màn hình Soát vé / Bán vé tại quầy (Staff POS):**
   * Giao diện quét mã QR nhanh để check-in khách vào phòng chiếu.
