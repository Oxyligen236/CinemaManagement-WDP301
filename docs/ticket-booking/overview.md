# Phân Hệ Nghiệp Vụ Đặt Vé (Ticket Booking System)

**Dự án:** `CinemaManagement-WDP301`  
**Đường dẫn tài liệu:** `docs/plans/ticket-booking/`  
**Phiên bản:** 2.0 (Chuẩn hóa toàn diện UML 2.x OMG, BCE Architecture Pattern & Event-Driven)

---

## 1. Cấu trúc Tài liệu & Hồ sơ Thiết kế

| STT | Tập tin | Phân loại | Quy chuẩn áp dụng | Nội dung chi tiết |
|:---:|---|---|---|---|
| 1 | [`class-diagram.mmd`](./class-diagram.mmd) | Class Diagram | **UML 2.x OMG Standard (Implementation Perspective)** | Mô hình hiện thực chi tiết (không dùng interface usecase): Boundary (Controllers/Consumers), Control (Services hiện thực hóa đầy đủ private/public methods & fields), Cross-module Contracts, Entities (Prisma Models), Domain Events, Enums. Phân định rõ Composition, Aggregation, Association, Dependency. |
| 2 | [`online/online-booking-sequence.mmd`](./online/online-booking-sequence.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Tương tác động đặt vé trực tuyến tổng thể: Giữ ghế tạm thời 10 phút, BullMQ delayed job, VNPay payment URL, Webhook IPN xử lý giao dịch, cấp phát vé QR điện tử. |
| 2.1 | [`online/stage1-reservation.mmd`](./online/stage1-reservation.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 1: Khách hàng chọn suất chiếu, ghế, combo và tạo đơn giữ chỗ tạm thời (10 phút). |
| 2.2 | [`online/stage2-payment-url.mmd`](./online/stage2-payment-url.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 2: Khởi tạo URL thanh toán trực tuyến qua cổng VNPay Gateway. |
| 2.3 | [`online/stage3-ipn-webhook.mmd`](./online/stage3-ipn-webhook.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 3: Webhook IPN xử lý kết quả giao dịch VNPay, chốt ghế BOOKED, sinh vé QR và trừ kho F&B. |
| 2.4 | [`online/stage4-client-return.mmd`](./online/stage4-client-return.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 4: Điều hướng khách hàng về Web/App sau thanh toán và hiển thị màn hình xác nhận đơn hàng. |
| 2.5 | [`online/stage5-hold-expiration.mmd`](./online/stage5-hold-expiration.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 5: Worker BullMQ xử lý hủy giữ chỗ và nhả ghế khi đơn hàng hết hạn 10 phút. |
| 3 | [`pos/pos-booking-sequence.mmd`](./pos/pos-booking-sequence.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Tương tác động bán vé tại quầy (POS) tổng thể: Ràng buộc chi nhánh theo `staffContext`, thanh toán tiền mặt/quét mã QR động, khóa ghế, trừ kho F&B chi nhánh, in vé nhiệt 80mm. |
| 3.1 | [`pos/stage1-order-creation.mmd`](./pos/stage1-order-creation.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 1 (POS): Thu ngân tạo đơn PENDING và giữ ghế theo chi nhánh. |
| 3.2 | [`pos/stage2-counter-payment.mmd`](./pos/stage2-counter-payment.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 2 (POS): Xử lý thanh toán tiền mặt (tính tiền thối) hoặc quét mã QR động. |
| 3.3 | [`pos/stage3-receipt-printing.mmd`](./pos/stage3-receipt-printing.mmd) | Sequence Diagram | **Hassan Gomaa BCE & UML 2.x** | Giai đoạn 3 (POS): Xuất cấu trúc biên lai và kích hoạt lệnh in vé/hóa đơn nhiệt 80mm. |
| 4 | [`backend-package-diagram.mmd`](./backend-package-diagram.mmd) | Package Diagram | **Mermaid Flowchart Subgraphs (UML Layered)** | Cấu trúc phân rã Package Backend NestJS: Presentation (Controllers), Application (Services), Cross-Module Contracts, Domain (Aggregates & Events), Infrastructure (Prisma, BullMQ, Redis, EventBus). |
| 5 | [`frontend-package-diagram.mmd`](./frontend-package-diagram.mmd) | Package Diagram | **Mermaid Flowchart Subgraphs (App Router)** | Cấu trúc phân rã Package Frontend: App Router (Routes theo Role), Components (UI widgets & modals), Data Access (lib/api & hooks), Core/Types (Utils & Formatters). |
| 6 | [`overview.md`](./overview.md) | Architectural Spec | **Technical Specification** | Tài liệu đặc tả tổng quan, quy chuẩn thiết kế, ma trận đối soát nghiệp vụ và hướng dẫn triển khai. |

---

## 2. Tiêu chuẩn Thiết kế Kỹ thuật (Architectural Compliance)

Hệ thống sơ đồ thiết kế được xây dựng và nghiệm thu nghiêm ngặt theo các tiêu chuẩn kiến trúc phần mềm quốc tế:

### 2.1. Chuẩn hóa Cú pháp Class Diagram (OMG UML 2.x)
- **Định dạng Thuộc tính (Attribute Specification):** Tuân thủ tuyệt đối quy chuẩn `visibility name: type [= default]`. Tuyệt đối không dùng cú pháp ngôn ngữ C++/Java (`+Type name`).
  - *Ví dụ chuẩn:* `+ id: String`, `+ totalAmount: Float`, `- orderService: OrderService`.
- **Định dạng Phương thức (Operation Specification):** Tuân thủ `visibility name(param: Type): ReturnType`.
  - *Ví dụ chuẩn:* `+ createBooking(req: AuthenticatedRequest, body: CreateBookingOrderReq): Promise~BookingSummaryRes~`.
- **Phân định chính xác 5 Mối quan hệ hướng đối tượng:**
  1. **Composition (`*--`):** Quan hệ sở hữu vòng đời chặt chẽ (Whole chết thì Part chết theo). Áp dụng giữa `Order` và các thực thể con phụ thuộc 100%: `Order *-- SeatOrder`, `Order *-- ProductOrder`, `Order *-- Ticket`, `Order *-- Payment`.
  2. **Aggregation (`o--`):** Quan hệ toàn thể - bộ phận lỏng lẻo thông qua **Constructor Dependency Injection** của NestJS. `OrderService` và `PosOrderService` tổng hợp các Contract/Broker phụ thuộc: `OrderService o-- ShowtimeBookingContract`, `OrderService o-- PaymentContract`, `OrderService o-- QueueService`...
  3. **Association (`-->`):** Tham chiếu ngang hàng độc lập giữa các thực thể domain: `SeatOrder --> SeatShowtime`, `Ticket --> SeatShowtime`, và liên kết tới các kiểu trạng thái `OrderStatus`, `PaymentMethod`, `PaymentStatus`...
  4. **Dependency (`..>`):** Quan hệ phụ thuộc tạm thời qua phương thức hoặc phát tán domain events: `OrderController ..> OrderService`, `OrderService ..> OrderCreatedEvent`, `OrderService ..> OrderPaidEvent`...
  5. **Loại bỏ Interface Usecase (Implementation Perspective):** Toàn bộ nghiệp vụ được gom trực tiếp vào các class service (`OrderService`, `PosOrderService`) với đầy đủ private/public methods và properties, giảm bớt tầng trung gian dư thừa theo đúng hiện trạng mã nguồn thực thi.

### 2.2. Chuẩn hóa Mô hình Tương tác BCE (Hassan Gomaa Sequence Diagram)
- **Phân loại vai trò theo BCE (Boundary - Control - Entity):**
  - **Boundary (`:Boundary`):** Các điểm tiếp nhận ngoại vi và giao diện: `CustomerClient`, `POS Client`, `OrderController`, `PosStaffController`, `VnpayReturnController`, `Máy in nhiệt 80mm`.
  - **Control (`:Control`):** Các bộ điều phối nghiệp vụ tập trung: `OrderService`, `PosOrderService`, `OrderExpirationConsumer`, và các Module Contracts điều phối xuyên phân hệ (`ShowtimeBookingContract`, `PaymentContract`, `TicketContract`, `ProductContract`, `PromotionContract`).
  - **Entity (`:Entity`):** Thực thể lưu trữ trạng thái dữ liệu bền vững: `PrismaDatabase`.
  - **Brokers / External:** `OrderExpirationQueue (BullMQ)`, `InternalEventBus`, `VNPayGateway`.
- **Quy tắc Lifeline & Activation Bar:** Mọi lời gọi đồng bộ (Synchronous Call `->>+`) **bắt buộc** phải được đóng bằng thông điệp phản hồi (Return Message `-->>-`) tương ứng để đảm bảo tính toàn vẹn của ngăn xếp kích hoạt (call stack).
- **Asynchronous Signal (`-)`):** Toàn bộ tương tác phát tán sự kiện sang Message Broker hoặc Queue đều sử dụng mũi tên bất đồng bộ mở `-)` (Non-blocking emit).
- **Combined Fragments chuẩn:**
  - `critical [DB Transaction: ...]`: Bao đóng các khối thao tác cơ sở dữ liệu nguyên tử (Atomic Commit / Rollback).
  - `alt [guard] ... else [guard]`: Biểu diễn rẽ nhánh loại trừ bắt buộc (`if ... else`).
  - `opt [guard]`: Biểu diễn các bước tùy chọn (`if` đơn, ví dụ áp mã khuyến mãi hoặc xử lý đơn hết hạn).
  - `loop [guard]`: Biểu diễn vòng lặp thăm dò trạng thái (Polling).

---

## 3. Tổng quan Kiến trúc Hai Luồng Nghiệp vụ

```
                             +-----------------------+
                             |   Actor: Customer /   |
                             |      POS Staff        |
                             +-----------+-----------+
                                         |
                                         v
                      +-------------------------------------+
                      |      Boundary Layer (BCE)           |
                      |  OrderController / PosStaffCtrl     |
                      +------------------+------------------+
                                         |
                                         v
                      +-------------------------------------+
                      |       Control Layer (BCE)           |
                      |    OrderService / PosOrderService   |
                      +----+-------------+----------------+-+
                           |             |                |
             +-------------+             v                +--------------+
             |                 +--------------------+                    |
             v                 |   Entity Layer     |                    v
+------------------------+     |   PrismaDatabase   |         +-----------------------+
| Cross-Module Contracts |     +--------------------+         |  Asynchronous Brokers |
| Showtime, Ticket,      |                                    | BullMQ / EventBus     |
| Product, Payment       |                                    +-----------------------+
+------------------------+
```

### 3.1. Đặt vé Trực tuyến (Online Booking - `Role.USER`)
1. **Khởi tạo & Khóa chỗ:** Khách hàng chọn suất chiếu, ghế và combo F&B. Hệ thống giữ ghế chuyển từ `EMPTY` sang `RESERVED` trong 10 phút (`ORDER_HOLD_TIMEOUT_MS = 600,000ms`).
2. **Quản lý Hết hạn:** Hệ thống đưa một delayed job vào BullMQ queue `order-expiration` với thời gian trễ 10 phút. Nếu hết hạn mà đơn chưa hoàn tất, worker tự động nhả ghế về `EMPTY` và đánh dấu đơn `EXPIRED`.
3. **Thanh toán Trực tuyến:** Khách hàng được chuyển hướng sang VNPay. Khi thanh toán thành công, VNPay gọi Webhook IPN (`GET /payments/vnpay/ipn`). Hệ thống kích hoạt transaction: chuyển ghế sang `BOOKED`, sinh vé điện tử `Ticket(VALID)`, khấu trừ tồn kho F&B và phát tán sự kiện `OrderPaidEvent`.

### 3.2. Bán vé tại Quầy (POS Booking - `Role.STAFF`)
1. **Kiểm tra Ràng buộc Chi nhánh:** Thu ngân chỉ được thao tác trên các suất chiếu và danh mục F&B thuộc đúng `branchId` của mình (xác thực qua JWT context).
2. **Linh hoạt Phương thức Thanh toán:**
   - **Tiền mặt (`CASH`):** Nhập số tiền nhận từ khách (`cashReceived`), hệ thống kiểm tra điều kiện `cashReceived >= totalAmount`, tự động tính tiền thối (`changeAmount`) và xác nhận thanh toán tức thời.
   - **Quét mã QR (`QR`):** Sinh mã QR động chuẩn hóa (VietQR / VNPay QR), hiển thị trên màn hình phụ hướng về phía khách. POS Client tự động poll trạng thái mỗi 2 giây.
3. **In Vé & Biên lai Nhiệt 80mm:** Sau khi thanh toán hoàn tất, POS Client gọi API `GET /staff/pos/orders/:orderId/receipt` lấy đầy đủ cấu trúc hóa đơn (thông tin rạp, mã barcode từng vé, ghế, F&B, tổng tiền, tiền thối) để kích hoạt lệnh cắt giấy in nhiệt tự động.

---

## 4. Ma trận Đối soát Kỹ thuật giữa Hai Luồng Nghiệp vụ

| Tiêu chí Đối soát | Luồng Đặt vé Trực tuyến (Online) | Luồng Đặt vé tại Quầy (POS) |
|---|---|---|
| **Actor chính** | Khách hàng cá nhân (`Role.USER`) | Nhân viên thu ngân (`Role.STAFF`) |
| **Boundary Controller** | `OrderController`, `VnpayReturnController` | `PosStaffController` |
| **Control Service** | `OrderService` | `PosOrderService` |
| **Phạm vi Dữ liệu (Scope)** | Toàn hệ thống (khách tự do chọn rạp) | Ràng buộc cố định theo `staffContext.branchId` |
| **Kênh Thanh toán** | Cổng thanh toán trực tuyến VNPay Gateway | Tiền mặt (`CASH`), Dynamic QR (`VNPAY`/`VIETQR`) |
| **Tính toán Tiền thối** | Không áp dụng (thanh toán chính xác qua Gateway) | Có (`changeAmount = cashReceived - totalAmount`) |
| **Cấp phát Vé** | Bản ghi số `Ticket(VALID)`, mã QR hiển thị trên Web/App | Bản ghi `Ticket(VALID)` + Lệnh in cuộn nhiệt 80mm |
| **Cơ chế Hết hạn Đơn** | BullMQ delayed worker (10 phút) | Hết hạn 10 phút hoặc thu ngân chủ động hủy giải phóng ghế |
| **Xử lý Transaction** | Atomic `$transaction` chốt ghế, vé và trừ tồn kho | Atomic `$transaction` chốt ghế, vé và trừ kho chi nhánh |
| **Phát tán Sự kiện** | `OrderCreatedEvent`, `OrderPaidEvent`, `OrderExpiredEvent` | `OrderCreatedEvent`, `OrderPaidEvent`, `OrderCancelledEvent` |

---

## 5. Hướng dẫn Hiển thị & Kiểm tra Tài liệu Sơ đồ

Các file định dạng Mermaid (`.mmd`) có thể hiển thị và kiểm tra thông qua các phương thức sau:

1. **Công cụ Soạn thảo (VS Code):** Cài đặt extension `Markdown Preview Mermaid Support` hoặc `Mermaid Preview` để xem trực tiếp.
2. **Mermaid Live Editor:** Sao chép mã nguồn sơ đồ vào [mermaid.live](https://mermaid.live) để kiểm tra tương tác đồ họa trực tuyến.
3. **Biên dịch SVG/PNG tự động qua Mermaid CLI:**
   ```bash
   npx @mermaid-js/mermaid-cli -i class-diagram.mmd -o class-diagram.svg
   npx @mermaid-js/mermaid-cli -i online-booking-sequence.mmd -o online-booking-sequence.svg
   npx @mermaid-js/mermaid-cli -i pos-booking-sequence.mmd -o pos-booking-sequence.svg
   ```
