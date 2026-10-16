# Project Rules

## Module Import Rule (Bắt buộc tuyệt đối)

- `@Module({ imports: [...] })` chỉ được chứa NestJS Module (`*Module`). Cấm import provider, service, controller, repository, guard, entity hoặc bất kỳ thứ gì khác vào `imports`.
- Liên kết giữa các module: Chỉ được import module (`XxxModule`), không import trực tiếp nội bộ module khác.

## Frontend Design System Rule (Bắt buộc)

- Khi thiết kế hoặc phát triển UI Frontend (`frontend/`), bắt buộc phải đọc và tuân thủ tài liệu `frontend/design.md` (bảng màu, token Tailwind CSS v4, component specs, accessibility, format `vi-VN`).
