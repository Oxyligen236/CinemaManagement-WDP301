# I.3 Entity Relationship Diagram

## 1. Conceptual Entity Relationship Diagram (ERD)

Conceptual ERD Diagram: [`conceptual-erd.mmd`](./conceptual-erd.mmd)

---

## 2. Entities Description Table

| # | Entity | Description |
|---|---|---|
| 01 | BRANCH | Represents a physical cinema branch in the system; stores venue name, address, hotline, and operational status; supports cinema facility management, auditorium allocation, inventory distribution, and staff assignment. |
| 02 | ROOM | Represents a physical screening room/auditorium within a cinema branch; stores room name and operational availability; used for seat layout configuration and showtime scheduling. |
| 03 | SEAT | Represents a fixed physical seat inside an auditorium; stores row/column coordinates, seat tier classification (Standard, VIP, Couple), and maintenance status; used for room layout mapping and dynamic seat pricing. |
| 04 | MOVIE | Represents a cinematic feature film distributed and screened by the cinema; stores film title, duration, screening status (Coming Soon, Now Showing, Ended), and release date; used for catalog management and schedule planning. |
| 05 | GENRE | Represents a standardized movie genre classification (Action, Horror, Animation, etc.); stores genre name and description; used for catalog categorisation and customer search/filtering. |
| 06 | SHOWTIME | Represents a scheduled movie screening in a specific auditorium at a designated time window; stores start time, end time, and base ticket price; used for customer booking and timetable management. |
| 07 | SEAT_SHOWTIME | Represents the dynamic availability state of an individual seat for a specific showtime; tracks real-time status (Empty, Reserved, Booked); powers real-time seat locking to prevent double bookings. |
| 08 | SEAT_PRICE_RULE | Represents pricing surcharge rules configured by seat classification (VIP, Couple); stores seat category and price adjustment value; used by dynamic pricing algorithms during ticket calculation. |
| 09 | DAY_PRICE_RULE | Represents pricing surcharge rules configured by date category (Weekday, Weekend, Public Holiday); stores day type and price adjustment value; supports flexible time-based pricing strategies. |
| 10 | ITEM | Represents an individual concession/F&B unit in cinema inventory (popcorn, soft drinks, snacks); tracks SKU category, unit price, cost price, on-hand stock quantity, and low-stock warning threshold; used for retail sales and inventory auditing. |
| 11 | COMBO | Represents bundled concession packages composed of multiple items; stores combo package title, package price, and commercial availability; used for counter POS and online promotional upselling. |
| 12 | PRODUCT | Represents a general retail product/merchandise entity across branches; stores product name, price, stock quantity, and operational status; maintained for auxiliary retail catalog compatibility. |
| 13 | USER | Represents registered user identities and system accounts across all roles (Customer, Staff, Manager, System Admin); stores authentication credentials, profile data, roles, and job positions; supports authentication, role-based access control, and transaction history tracking. |
| 14 | WORK_SCHEDULE | Represents structured work shifts planned for cinema branch staff; stores shift title, shift start/end times, total duration, and assigned personnel list; supports branch-level staff shift planning. |
| 15 | SHIFT_ATTENDANCE | Represents recorded time-and-attendance events for staff members against assigned work schedules; tracks work date, actual check-in/check-out timestamps, and attendance status; used for payroll calculation and work compliance verification. |
| 16 | ORDER | Represents a master customer purchase transaction aggregating movie tickets and concession products; tracks payable total amount and fulfillment status lifecycle; coordinates checkout workflows and financial reconciliation. |
| 17 | SEAT_ORDER | Represents a booked seat line item bound to an order; links the reserved seat-showtime slot with the locked ticket price at time of purchase; used for ticketing sales audits and movie box-office revenue accounting. |
| 18 | PRODUCT_ORDER | Represents a concession/combo purchase line item bound to an order; tracks SKU identifier, purchase quantity, and agreed unit price; triggers inventory deductions and food-and-beverage revenue auditing. |
| 19 | TICKET | Represents an official electronic admission pass generated upon successful order settlement; stores unique ticket verification code (QR/barcode), locked admission price, gate validation status, and scanning audit trail; used for gate check-in admission control. |
| 20 | PAYMENT | Represents a financial transaction settlement log for an order; stores transaction monetary amount, payment method (VNPay, MoMo, Cash, Credit Card), external gateway transaction ID, and verification status; used for gateway reconciliation and accounting audits. |
| 21 | PROMOTION | Represents a promotional campaign or discount voucher; stores voucher code, discount calculation type (Percentage or Fixed Amount), discount monetary value, validity time range, and redemption constraints; used for marketing promotions. |
| 22 | PROMOTION_USAGE | Represents an immutable redemption ledger record tracking when a customer redeems a promotion against an order; records user reference, order reference, and timestamp; enforces per-user promotion usage limits. |
