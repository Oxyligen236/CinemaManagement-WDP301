# Context Index: Agents Definitions

- [planner.md](planner.md): Kiến trúc sư — phân tích ranh giới, ma trận phụ thuộc, contracts và cấu hình @Module. Dùng SystemOne.
- [executor.md](executor.md): Lập trình viên — triển khai code chuẩn DDD theo plan, tuân thủ contract mock spec và naming.
- [auditor.md](auditor.md): Kiểm thử viên — kiểm thử 2 pha (Pha 1 mock nội bộ, Pha 2 tích hợp toàn bộ). Dùng SystemOne gating PASS/FAIL.
- [runner.md](runner.md): Điều phối viên — điều phối N Executor chạy song song và Auditor test 2 pha. Đánh giá hội tụ qua SystemOne.