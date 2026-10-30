# Tài Liệu Thiết Kế & Kiến Trúc Dự Án WDP

Tổng quan cấu trúc tài liệu thiết kế (SRS & SDS) của hệ thống Quản lý Rạp chiếu phim Cinema Management (WDP301).

---

## 1. Kiến Trúc Hệ Thống & Cơ Sở Dữ Liệu

- **I.1 Code Packages (System Architecture & Module Dependencies):**
  - Tài liệu chi tiết: [`code-packages.md`](./code-packages.md)
  - Sơ đồ package tổng thể (PlantUML): [`code-packages.puml`](./code-packages.puml)
- **I.2 Database Design (MongoDB / Mongoose):**
  - Tài liệu chi tiết: [`database-design.md`](./database/database-design.md)
  - Sơ đồ quan hệ & cấu trúc collection: [`database-design.mmd`](./database/database-design.mmd)
- **I.3 Entity Relationship Diagram (Conceptual ERD):**
  - Tài liệu chi tiết & Bảng mô tả thực thể: [`conceptual-erd.md`](./database/conceptual-erd.md)
  - Sơ đồ ERD khái niệm: [`conceptual-erd.mmd`](./database/conceptual-erd.mmd)

---

## 2. Thiết Kế Chi Tiết Module / Code Designs (`docs/code-design/`)

- **Order Module:**
  - Tài liệu kỹ thuật: [`order-design.md`](./code-design/order/order-design.md)
  - Class Diagram: [`class-diagram.mmd`](./code-design/order/class-diagram.mmd)
  - Sequence Diagrams:
    - Đặt vé Online: [`seq-online-booking.mmd`](./code-design/order/seq-online-booking.mmd)
    - Tạo đơn tại quầy POS: [`seq-pos-order.mmd`](./code-design/order/seq-pos-order.mmd)
    - Thanh toán VNPay: [`seq-vnpay-fulfillment.mmd`](./code-design/order/seq-vnpay-fulfillment.mmd)
    - Thanh toán tiền mặt tại quầy: [`seq-pos-cash-payment.mmd`](./code-design/order/seq-pos-cash-payment.mmd)
    - Hủy đơn hàng: [`seq-order-cancellation.mmd`](./code-design/order/seq-order-cancellation.mmd)
    - Tra cứu lịch sử & Chi tiết đơn: [`seq-order-history-detail.mmd`](./code-design/order/seq-order-history-detail.mmd)

- **Product Module:**
  - Tài liệu kỹ thuật: [`product-design.md`](./code-design/product/product-design.md)
  - Class Diagram: [`class-diagram.mmd`](./code-design/product/class-diagram.mmd)
  - Sequence Diagrams:
    - Điều chỉnh tồn kho: [`seq-adjust-stock.mmd`](./code-design/product/seq-adjust-stock.mmd)
    - Trừ kho khi xử lý đơn: [`seq-deduct-inventory.mmd`](./code-design/product/seq-deduct-inventory.mmd)
    - Tạo mới Item: [`seq-create-item.mmd`](./code-design/product/seq-create-item.mmd)
    - Lấy danh mục F&B cho Staff: [`seq-staff-concession-catalog.mmd`](./code-design/product/seq-staff-concession-catalog.mmd)

- **Promotion Module:**
  - Tài liệu kỹ thuật: [`promotion-design.md`](./code-design/promotion/promotion-design.md)
  - Class Diagram: [`class-diagram.mmd`](./code-design/promotion/class-diagram.mmd)
  - Sequence Diagrams:
    - Tạo chương trình khuyến mãi: [`seq-create-promotion.mmd`](./code-design/promotion/seq-create-promotion.mmd)
    - Cập nhật khuyến mãi: [`seq-update-promotion.mmd`](./code-design/promotion/seq-update-promotion.mmd)
    - Áp dụng mã khuyến mãi: [`seq-apply-promotion.mmd`](./code-design/promotion/seq-apply-promotion.mmd)
    - Ghi nhận lịch sử sử dụng khuyến mãi: [`seq-record-promotion-usage.mmd`](./code-design/promotion/seq-record-promotion-usage.mmd)

- **Ticket Module:**
  - Tài liệu kỹ thuật: [`ticket-design.md`](./code-design/ticket/ticket-design.md)
  - Class Diagram: [`class-diagram.mmd`](./code-design/ticket/class-diagram.mmd)
  - Sequence Diagrams:
    - Quét & Soát vé: [`seq-scan-ticket.mmd`](./code-design/ticket/seq-scan-ticket.mmd)
    - Tra cứu chi tiết vé: [`seq-ticket-detail.mmd`](./code-design/ticket/seq-ticket-detail.mmd)
    - Phát hành vé tự động: [`seq-create-tickets.mmd`](./code-design/ticket/seq-create-tickets.mmd)

---

## 3. Sơ Đồ Màn Hình Frontend (`docs/screen.mmd`)

- Sơ đồ luồng chuyển màn hình toàn bộ ứng dụng Frontend: [`screen.mmd`](./screen.mmd)

---

## 4. Kế Hoạch Triển Khai & Kiểm Thử (`docs/plans/`)

- Chứa toàn bộ các kế hoạch thực hiện (`*.plan.md`) và báo cáo audit nghiệm thu (`*.audit.md`) theo từng đợt phát triển tính năng.
