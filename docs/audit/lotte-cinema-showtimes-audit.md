# Audit Report: Lotte Cinema Showtime Schedules Clone [Pha 2: Tích hợp toàn bộ & Dữ liệu thật từ DB]

**Plan:** `docs/plans/lotte-cinema-showtime-clone.plan.md`  
**Verdict:** ✅ PASS  

## Kết quả kiểm tra chi tiết

- **Tuân thủ Dữ liệu thật & Không dùng Mock Data:** ✅ PASS
  - Toàn bộ mock data, `MOCK_*`, mảng dữ liệu giả lập và fallback mock cứng trong `frontend/lib/api/showtimes-public.api.ts` và `frontend/app/showtimes/**` đã được loại bỏ triệt để.
  - Khi không gọi được server hoặc lỗi, client hiển thị state thông báo lỗi trực quan kèm nút "Thử lại" thay vì hiển thị dữ liệu giả lập.
  - Dữ liệu 100% truy vấn trực tiếp từ MongoDB qua các API: `GET /branches/public`, `GET /showtimes/public`, `GET /movies`.

- **Tuân thủ Contracts & Ranh giới Module:** ✅ PASS
  - `BranchModule` cung cấp `GetPublicBranchesUsecase` (`get-public-branches.usecase.ts`), DTO `GetPublicBranchesReqDto` (có validator) & `PublicBranchResDto` (không validator).
  - `ShowtimeModule` cung cấp `GetPublicShowtimesUsecase` (`get-public-showtimes.usecase.ts`), DTO `GetPublicShowtimesReqDto` (có validator) & `PublicShowtimeItemResDto` (không validator).
  - Clean Architecture / DDD: 1 file = 1 interface usecase duy nhất, không tiền tố `I`, JSDoc chuẩn format.
  - Các service (`BranchQueryService`, `PublicShowtimeQueryService`) là class duy nhất trong file, inject và query trực tiếp qua Mongoose Model, không tạo tầng repository trung gian.
  - Ranh giới module: `@Module({ imports: [...] })` chỉ chứa module NestJS và `MongooseModule.forFeature(...)`. Không import cross-module internals/entities.
  - Sơ đồ màn hình `docs/screen.mmd` đã cập nhật route `/showtimes` nối với `/booking/[showtimeId]`.

- **Seed Script & Database:** ✅ PASS
  - Script seed `backend/scripts/seed-showtimes-public.ts` hoạt động chuẩn xác, idempotent:
    * 4 chi nhánh rạp đang hoạt động (ACTIVE).
    * 7 thể loại phim.
    * 5 phim đang chiếu kèm poster, thời lượng, thể loại.
    * 8 phòng chiếu và 256 ghế.
    * 280 suất chiếu và 8960 trạng thái ghế suất chiếu (SeatShowtime).

- **Build & Tests:** ✅ PASS
  - Backend: `npm test` passed 100% (25 test suites, 294 tests passed).
  - Backend: `npm run build` thành công, không có lỗi circular dependency hay DI injection.
  - Frontend: `npm run build` thành công 100% (Next.js 16.3.7 Turbopack), route `/showtimes` biên dịch thành công.

- **Playwright E2E Testing:** ✅ PASS
  - Script `frontend/e2e/lotte-cinema-showtimes.spec.ts` tương thích toàn diện với luồng người dùng và dữ liệu thật:
    * Truy cập `/showtimes`
    * Unhappy path: Chưa chọn rạp -> Empty state nhắc chọn rạp
    * Chọn rạp `branch-cantavil` -> Tải danh sách phim và suất chiếu thật
    * Chọn ngày trên `DateTabBar` -> Lọc suất chiếu theo ngày
    * Hover slot giờ chiếu -> Hiển thị chi tiết giờ kết thúc, phòng chiếu, giá vé
    * Click slot -> Điều hướng sang `/booking/[showtimeId]`
    * Unhappy path: Ngày không có suất chiếu -> Empty state hướng dẫn
    * Error state: Hiển thị banner lỗi khi mất kết nối máy chủ.
