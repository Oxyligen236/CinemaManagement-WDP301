# Cinema Management Backend (NestJS + Prisma + MongoDB)

Hệ thống Backend cho dự án Quản lý Rạp chiếu phim Cinema Management (WDP301).

---

## 1. Yêu cầu hệ thống

- **Node.js**: >= 20.x (khuyến nghị Node 22 LTS)
- **Database**: MongoDB Replica Set (để hỗ trợ Prisma transactions)

---

## 2. Các bước cài đặt chi tiết

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Thiết lập biến môi trường
Tạo file `.env` tại thư mục `backend/` từ `.env.example` hoặc điền cấu hình:
```env
PORT=8010
NODE_ENV=development
MONGODB_URI="mongodb://root:<password>@<host>:27017/wdp_project?authSource=admin&replicaSet=rs0&directConnection=true"
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### Bước 3: Sinh Prisma Client (BẮT BUỘC)
Sau khi clone repo hoặc chạy `npm install`, **bắt buộc** phải sinh mã Prisma Client:
```bash
npx prisma generate
```
> **Tại sao cần bước này?** Thư mục generated `node_modules/.prisma/client` nằm trong `.gitignore` không đẩy lên GitHub. Lệnh này đọc `prisma/schema.prisma` để biên dịch các Enums, Models và Native Query Engine.

### Bước 4: Khởi tạo dữ liệu mẫu (Seed Data)
Tạo dữ liệu rạp, phòng chiếu, phim, ghế và các tài khoản mẫu:
```bash
npx prisma db seed
```
- Mật khẩu mặc định của tất cả tài khoản test: `12345678`
- Tài khoản Admin mẫu: `admin@cinema.com`

---

## 3. Khởi chạy dự án

```bash
# Chạy ở chế độ Development (tự reload khi đổi code)
npm run start:dev

# Build ứng dụng cho Production
npm run build

# Chạy ứng dụng Production sau khi build
npm run start:prod
```

---

## 4. Kiểm tra & Chạy Tests

```bash
# Chạy toàn bộ Unit Tests
npm test

# Chạy test với coverage
npm run test:cov
```

---

## 5. Xử lý các lỗi thường gặp (Troubleshooting)

### 1. Lỗi `error TS2305: Module '@prisma/client' has no exported member...`
- **Nguyên nhân:** Chưa chạy `npx prisma generate`.
- **Khắc phục:** Chạy lệnh `npx prisma generate` trong thư mục `backend/`.

### 2. Cảnh báo đỏ trong VS Code: `The datasource property 'url' is no longer supported in schema files...`
- **Nguyên nhân:** Extension Prisma trên VS Code tự động cập nhật lên v7, trong khi dự án sử dụng Prisma 6.
- **Khắc phục:** 
  - Mở VS Code, nhấn `Ctrl + Shift + P` -> gõ chọn **`Prisma: Pin to Prisma 6`**.
  - Hoặc tạo file `.vscode/settings.json` trong workspace với nội dung:
    ```json
    {
      "prisma.pinToPrisma6": true
    }
    ```

### 3. Lỗi `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`
- **Nguyên nhân:** Server dev (`npm run start:dev`) hoặc process Node.js đang chạy và chiếm quyền file engine.
- **Khắc phục:** Tắt terminal đang chạy server dev (`Ctrl + C`), sau đó chạy lại `npx prisma generate`.
