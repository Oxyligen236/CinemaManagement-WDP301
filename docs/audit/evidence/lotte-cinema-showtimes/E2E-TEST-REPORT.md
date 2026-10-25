# Báo Cáo Kiểm Thử E2E - Lịch Chiếu Phim Lotte Cinema

- **Tính năng**: Trang lịch chiếu phim (`/showtimes`) clone giao diện Lotte Cinema + lọc chi nhánh (Branch Droplist).
- **Môi trường**: Backend NestJS (port 8010), Frontend Next.js (port 3000), MongoDB Database thực tế.
- **Dữ liệu**: Dữ liệu thật 100% từ database, không sử dụng mock/fallback data trong frontend.
- **Ngày thực hiện**: 2026-10-26

---

## 1. Danh Sách Luồng Kiểm Thử & Ảnh Chụp Minh Chứng

Thư mục lưu trữ: `docs/audit/evidence/lotte-cinema-showtimes/`

| STT | Luồng kiểm thử | Trạng thái | Tên file ảnh | Mô tả chi tiết |
|---|---|---|---|---|
| 01 | Initial View | Happy | `01-showtimes-initial-view.png` | Người dùng truy cập trang `/showtimes`, hệ thống tải danh sách chi nhánh và hiển thị rạp đầu tiên. |
| 02 | Empty State: Chưa chọn rạp | Unhappy | `02-showtimes-empty-no-branch.png` | Người dùng chọn mục rỗng trong dropdown chi nhánh, hiển thị empty state `Vui lòng chọn rạp chiếu`. |
| 03 | Chọn rạp từ Droplist | Happy | `03-showtimes-branch-selected.png` | Người dùng chọn chi nhánh `Lotte Cinema Cantavil`, hiển thị thông tin rạp và thanh chọn ngày. |
| 04 | Chọn ngày chiếu (Date Tab) | Happy | `04-showtimes-date-selected.png` | Người dùng chọn ngày chiếu trong thanh cuộn 14 ngày, highlight ngày được chọn. |
| 05 | Danh sách phim & Suất chiếu | Happy | `05-showtimes-movie-slots.png` | Hiển thị các phim đang chiếu kèm poster, thời lượng, thể loại, phòng chiếu và các khung giờ. |
| 06 | Hover & Click Slot giờ | Happy | `06-showtimes-slot-hover-click.png` | Thao tác tương tác với nút slot giờ chiếu (hiển thị giờ bắt đầu - kết thúc, số ghế trống/tổng số ghế). |
| 07 | Điều hướng Đặt vé | Happy | `07-booking-page-redirected.png` | Click vào slot giờ chiếu chuyển hướng đến màn hình đặt ghế `/booking/[showtimeId]`. |
| 08 | Empty State: Không có suất | Unhappy | `08-showtimes-empty-no-showtimes.png` | Chọn ngày không có lịch chiếu trong DB, hiển thị empty state `Chưa có lịch chiếu cho ngày đã chọn`. |
| 09 | Error State: Lỗi kết nối | Unhappy | `09-showtimes-error-state.png` | Gặp lỗi mạng/API từ backend, hiển thị banner cảnh báo màu đỏ kèm nút `Thử lại`. |

---

## 2. Chi Tiết Từng Luồng Kiểm Thử

### 2.1. Luồng Happy Path: Xem lịch chiếu và điều hướng đặt vé
1. **Truy cập**: Người dùng vào URL `/showtimes`. Frontend gọi `GET /branches/public` lấy danh sách chi nhánh thực từ MongoDB.
2. **Chọn chi nhánh**: Dropdown hiển thị đầy đủ các chi nhánh hoạt động (`Lotte Cinema Cantavil`, `Lotte Cinema Gò Vấp`, v.v.).
3. **Chọn ngày**: Thanh `DateTabBar` hiển thị 14 ngày liên tiếp. Mặc định chọn ngày hiện tại.
4. **Hiển thị suất chiếu**: Gọi API `GET /showtimes/public?branchId=...&date=...`. Nhóm suất chiếu theo từng phim, hiển thị poster, tag định dạng (2D Phụ Đề, ScreenX), phòng chiếu, giờ chiếu và số lượng ghế trống thực tế (`availableSeats`/`totalSeats`).
5. **Chọn suất chiếu**: Click nút slot giờ chiếu chuyển hướng người dùng sang `/booking/[showtimeId]`.

### 2.2. Luồng Unhappy Path
1. **Chưa chọn chi nhánh**: Dropdown ở trạng thái chưa chọn (`value=""`), màn hình hiển thị biểu tượng rạp chiếu cùng thông báo yêu cầu người dùng chọn rạp.
2. **Ngày không có lịch chiếu**: Khi người dùng chọn một ngày xa hoặc rạp chưa có lịch trong DB, hiển thị empty state thông báo rõ ràng kèm gợi ý chọn ngày khác.
3. **Lỗi API / Mạng**: Khi API backend trả về mã lỗi hoặc mất kết nối, hiển thị `ShowtimeErrorBanner` thông báo lỗi thân thiện và cung cấp nút `Thử lại` để kích hoạt fetch lại dữ liệu.
