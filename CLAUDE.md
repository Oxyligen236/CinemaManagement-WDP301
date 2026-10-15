# Project Rules

## Module Import Rule (Bắt buộc tuyệt đối)

- `@Module({ imports: [...] })` chỉ được chứa NestJS Module (`*Module`). Cấm import provider, service, controller, repository, guard, entity hoặc bất kỳ thứ gì khác vào `imports`.
- Liên kết giữa các module: Chỉ được import module (`XxxModule`), không import trực tiếp nội bộ module khác.
