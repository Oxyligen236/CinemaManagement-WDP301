# Project Rules

## Module Import Rule (Bắt buộc tuyệt đối)

- `@Module({ imports: [...] })` chỉ được chứa NestJS Module (`*Module`). Cấm import provider, service, controller, repository, guard, entity hoặc bất kỳ thứ gì khác vào `imports`.
- Liên kết giữa các module: Chỉ được import module (`XxxModule`), không import trực tiếp nội bộ module khác.

## Database Access Rule (Không dùng Repository)

- Không tạo tầng Repository trung gian (`*repository.ts`, `*repository.interface.ts`).
- Inject và sử dụng trực tiếp Mongoose Model (`@InjectModel(Xxx.name) private readonly xxxModel: Model<XxxDocument>`) trong các Class Service.

## Usecase Interface & Service Rule (Bắt buộc)

- **Thư mục usecase**: Đặt tên thư mục chứa interface usecase là `usecase` (đường dẫn: `src/modules/<module>/application/usecase/`).
- **Đặt tên file usecase**: `xxxx.usecase.ts` (ví dụ: `create-promotion.usecase.ts`).
- **1 file = 1 interface usecase duy nhất**: Trong 1 file usecase chỉ được chứa duy nhất 1 interface usecase.
- **Không dùng tiền tố `I`** cho interface (ví dụ: `CreatePromotionUsecase`, KHÔNG dùng `ICreatePromotionUsecase`).
- **Chia nhỏ interface usecase**: Mỗi interface phục vụ một giá trị nghiệp vụ cụ thể (single business value), không gộp tất cả usecase của module vào 1 interface khổng lồ.
- **Quy tắc file service**: Trong các file service (`*.service.ts`), chỉ được chứa duy nhất 1 class service implement, không chứa bất kỳ thứ khác (không khai báo interface, không helper/types phụ). Một Class Service có thể implement nhiều usecase interface.
- **Comment giá trị nghiệp vụ**:
  - Ghi comment mô tả giá trị nghiệp vụ phía trên mỗi interface usecase.
  - Mỗi hàm trong interface usecase bắt buộc có JSDoc format chuẩn:
    ```typescript
    /**
     * [Mục đích của hàm]
     *
     * Quy trình nghiệp vụ:
     * 1. [Bước 1]
     * 2. [Bước 2]
     *
     * @param [name] - [Mô tả tham số]
     * @returns [Mô tả kết quả trả về]
     * @throws [ExceptionType] khi [điều kiện ném lỗi]
     */
    ```

## DTO & Pagination Rule (Bắt buộc)

- **Cấu trúc file DTO trong module**: Chia làm 2 file đặt tại `application/dto/`:
  - `req.dto.ts`: Chứa toàn bộ Request DTO (giá trị đầu vào), bắt buộc có validation decorators (`class-validator`, `class-transformer`). Tên class Request DTO bắt buộc có hậu tố `Req` (ví dụ: `CreatePromotionReq`, `QueryPromotionsReq`, cấm dùng `CreatePromotionDto`).
  - `res.dto.ts`: Chứa toàn bộ Response DTO (giá trị đầu ra), **không chứa validator**. Tên class Response DTO bắt buộc có hậu tố `Res` (ví dụ: `PromotionRes`, `OrderDetailRes`, cấm dùng `PromotionResponseDto`).
- **Phân trang**:
  - DTO Request phân trang: Đặt trong `req.dto.ts` và bắt buộc `extends PageRequest` (từ `src/common/dto/page.dto`).
  - Response phân trang: Bắt buộc trả về `Page<T>` (sử dụng `Page.from(...)` từ `src/common/dto/page.dto`), không tự định nghĩa class response phân trang riêng lẻ cho từng module.

## Frontend Design System Rule (Bắt buộc)

- Khi thiết kế hoặc phát triển UI Frontend (`frontend/`), bắt buộc phải đọc và tuân thủ tài liệu `frontend/design.md` (bảng màu, token Tailwind CSS v4, component specs, accessibility, format `vi-VN`).

## Frontend Screen Flow Rule (Bắt buộc)

- Khi triển khai hoặc cập nhật UI Frontend (`frontend/`), bắt buộc phải cập nhật sơ đồ màn hình vào `docs/screen.mmd`.
- Biểu diễn các màn hình có trong hệ thống và cách chuyển từ màn hình này sang màn hình khác (trigger/action điều hướng).
- Thông tin ngắn gọn, súc tích, hạn chế chi tiết (chỉ ghi route/tên màn hình và action chuyển tiếp, dùng Mermaid `flowchart` hoặc `stateDiagram-v2`).
