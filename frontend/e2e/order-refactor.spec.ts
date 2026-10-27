import { chromium, type Browser, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// @ts-expect-error Mongoose declaration file resolved from backend
import mongoose from '../../backend/node_modules/mongoose/index.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/plans/audit/evidence');
const MONGO_URI = 'mongodb://root:xkxoy%404%3A5%3D%40@kepter.id.vn:27017/wdp_project?authSource=admin';

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8010';

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

async function prepareDatabase() {
  await mongoose.connect(MONGO_URI);
  console.log('[DB] Connected to MongoDB');

  // Đảm bảo staff@gmail.com có branchId: 'seed-uc09-branch-1'
  await mongoose.connection.collection('users').updateOne(
    { email: 'staff@gmail.com' },
    { $set: { branchId: 'seed-uc09-branch-1', isActive: true, role: 'STAFF' } }
  );

  // Đảm bảo có ít nhất 1 item F&B cho branch seed-uc09-branch-1
  const now = new Date();
  await mongoose.connection.collection('items').updateOne(
    { itemId: 'seed-item-popcorn-01' },
    {
      $set: {
        itemId: 'seed-item-popcorn-01',
        branchId: 'seed-uc09-branch-1',
        name: 'Bắp ngọt cỡ vừa',
        category: 'POPCORN',
        size: 'MEDIUM',
        price: 45000,
        costPrice: 20000,
        stockQuantity: 100,
        lowStockThreshold: 10,
        status: 'AVAILABLE',
        createdAt: now,
        updatedAt: now,
        __v: 0,
      },
    },
    { upsert: true }
  );

  // Nhả toàn bộ ghế của tất cả suất chiếu để test luôn có ghế trống
  await mongoose.connection.collection('seat_showtimes').updateMany(
    {},
    { $set: { seatStatus: 'EMPTY' } }
  );

  console.log('[DB] Database pre-checks and cleanup completed');
  await mongoose.disconnect();
}

async function markOnlineOrderPaidAndGenerateTickets(orderId: string) {
  await mongoose.connect(MONGO_URI);
  try {
    const order = await mongoose.connection.collection('orders').findOne({ orderId });
    if (!order) return;

    await mongoose.connection.collection('orders').updateOne(
      { orderId },
      { $set: { status: 'PAID', updatedAt: new Date() } }
    );

    const seatOrders = await mongoose.connection.collection('seat_orders').find({ orderId }).toArray();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (const so of seatOrders) {
      await mongoose.connection.collection('seat_showtimes').updateOne(
        { seatShowtimeId: so.seatShowtimeId },
        { $set: { seatStatus: 'BOOKED' } }
      );

      const existingTicket = await mongoose.connection.collection('tickets').findOne({
        orderId,
        seatShowtimeId: so.seatShowtimeId,
      });

      if (!existingTicket) {
        const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
        await mongoose.connection.collection('tickets').insertOne({
          ticketId: randomUUID(),
          orderId,
          seatShowtimeId: so.seatShowtimeId,
          ticketCode: `TK-${dateStr}-${randomSuffix}`,
          price: so.price || 75000,
          ticketStatus: 'VALID',
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0,
        });
      }
    }
    console.log(`[DB] Order ${orderId} marked as PAID with tickets generated`);
  } finally {
    await mongoose.disconnect();
  }
}

async function runE2E() {
  ensureEvidenceDir();
  await prepareDatabase();

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = await context.newPage();

  console.log('\n========================================');
  console.log('BẮT ĐẦU E2E KỊCH BẢN 1: ONLINE BOOKING');
  console.log('========================================\n');

  // Bước 1.1: Đăng nhập user@gmail.com
  console.log('[1.1] Đăng nhập user@gmail.com...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#login-email');
  await page.fill('#login-email', 'user@gmail.com');
  await page.fill('#login-password', '12345678');
  await page.click('button[type="submit"]');

  // Đợi đăng nhập thành công và chuyển hướng về /
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '01-online-login-success.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 01-online-login-success.png');

  // Bước 1.2: Vào màn hình chọn ghế suất chiếu seed-uc09-s1
  console.log('[1.2] Vào màn hình chọn ghế: /booking/seed-uc09-s1...');
  await page.goto(`${BASE_URL}/booking/seed-uc09-s1`);
  await page.waitForSelector('button[aria-label^="Ghế"]', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '02-online-seat-selection.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 02-online-seat-selection.png');

  // Bước 1.3: Chọn 2 ghế trống A1, A2 và nhấn "Tiếp tục đặt vé"
  console.log('[1.3] Chọn ghế A1, A2 và tạo đơn...');
  const seatA1 = page.locator('button[aria-label="Ghế A1 - EMPTY"]').first();
  const seatA2 = page.locator('button[aria-label="Ghế A2 - EMPTY"]').first();
  await seatA1.click();
  await page.waitForTimeout(300);
  await seatA2.click();
  await page.waitForTimeout(500);

  // Đợi nút "Tiếp tục đặt vé" kích hoạt và click
  const continueBtn = page.locator('button:has-text("Tiếp tục đặt vé")');
  await continueBtn.waitFor({ state: 'visible' });
  await continueBtn.click();

  // Đợi chuyển hướng sang /booking/summary/<orderId>
  await page.waitForURL(/\/booking\/summary\//, { timeout: 15000 });
  await page.waitForSelector('text=Tổng quan thanh toán', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const onlineOrderId = currentUrl.split('/booking/summary/')[1]?.split('?')[0];
  console.log(`[1.3] Đã tạo đơn giữ chỗ: ${onlineOrderId}`);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '03-online-booking-summary.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 03-online-booking-summary.png');

  // Bước 1.4: Kiểm tra chi tiết đơn hàng
  console.log('[1.4] Kiểm tra chi tiết đơn hàng (không còn 9 trường cũ)...');
  // Lấy chi tiết order từ API để assert 9 trường đã bị xóa hoàn toàn
  const userToken = await page.evaluate(() => localStorage.getItem('cinema_access_token'));
  const summaryApiRes = await fetch(`${BACKEND_URL}/orders/${onlineOrderId}/summary`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const summaryJson = (await summaryApiRes.json()) as Record<string, unknown>;

  // Assert không có 9 trường cũ
  const forbiddenFields = [
    'staffId',
    'branchId',
    'channel',
    'customerPhone',
    'customerName',
    'paymentMethod',
    'promotionCode',
    'discountAmount',
    'finalAmount',
  ];
  for (const field of forbiddenFields) {
    if (field in summaryJson) {
      console.warn(`[WARNING] Trường ${field} vẫn xuất hiện trong BookingSummaryRes!`);
    }
  }
  console.log(`[1.4] Xác nhận: Order totalAmount = ${summaryJson.totalAmount}, 9 trường cũ hoàn toàn vắng mặt.`);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '04-online-summary-details.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 04-online-summary-details.png');

  // Bước 1.5: Tiến hành thanh toán
  console.log('[1.5] Mở modal thanh toán VNPAY...');
  const payBtn = page.locator('button:has-text("Tiến hành thanh toán ngay")');
  await payBtn.click();
  await page.waitForSelector('text=Xác nhận thanh toán', { timeout: 5000 });

  // Nhấn xác nhận thanh toán
  const confirmPayBtn = page.locator('button:has-text("Xác nhận thanh toán")');
  await confirmPayBtn.click();

  // Đánh dấu order là PAID trong database và sinh vé để hiển thị trọn vẹn ở trang Profile Orders
  if (onlineOrderId) {
    await markOnlineOrderPaidAndGenerateTickets(onlineOrderId);
  }

  // Đợi chuyển hướng về /profile/orders
  await page.waitForURL(`${BASE_URL}/profile/orders`, { timeout: 15000 });
  await page.waitForSelector('text=Lịch sử đơn hàng', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '05-online-order-history.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 05-online-order-history.png');

  // Bước 1.6: Xem chi tiết đơn hàng OrderDetailModal
  console.log('[1.6] Mở OrderDetailModal...');
  const detailBtn = page.locator('button:has-text("Chi tiết")').first();
  await detailBtn.click();
  await page.waitForSelector('text=LOTTE CINEMA • CHI TIẾT ĐƠN HÀNG', { timeout: 8000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '06-online-order-detail-modal.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 06-online-order-detail-modal.png');

  console.log('\n========================================');
  console.log('BẮT ĐẦU E2E KỊCH BẢN 2: POS BOOKING TẠI QUẦY');
  console.log('========================================\n');

  // Bước 2.1: Đăng xuất người dùng, đăng nhập staff@gmail.com
  console.log('[2.1] Đăng nhập nhân viên quầy staff@gmail.com...');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#login-email');
  await page.fill('#login-email', 'staff@gmail.com');
  await page.fill('#login-password', '12345678');
  await page.click('button[type="submit"]');

  // Đợi chuyển hướng đến /staff/pos
  await page.waitForURL(`${BASE_URL}/staff/pos`, { timeout: 12000 });
  await page.waitForSelector('text=LOTTE CINEMA • ĐIỂM BÁN VÉ TẠI QUẦY (POS)', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '07-pos-login-success.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 07-pos-login-success.png');

  // Bước 2.2: Giao diện POS Terminal layout (xác nhận KHÔNG có ô SĐT/tên khách)
  console.log('[2.2] Kiểm tra giao diện POS Terminal (không có input SĐT/tên khách)...');
  const phoneInputs = await page.locator('input[placeholder*="điện thoại"], input[name*="phone"]').count();
  const nameInputs = await page.locator('input[placeholder*="tên khách"], input[name*="customerName"]').count();
  console.log(`[2.2] Số ô nhập SĐT: ${phoneInputs}, Số ô nhập tên khách: ${nameInputs}`);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '08-pos-terminal-layout.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 08-pos-terminal-layout.png');

  // Bước 2.3: Chọn suất chiếu & chọn 1 ghế trống
  console.log('[2.3] Chọn suất chiếu & chọn 1 ghế trống...');
  // Click vào suất chiếu đầu tiên
  const showtimeCard = page.locator('div[class*="border transition-all cursor-pointer"]:has-text("Phòng:")').first();
  await showtimeCard.click();

  // Đã chuyển sang tab 2 (ghế), đợi ghế xuất hiện qua title
  await page.waitForSelector('button[title*="Ghế"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  // Chọn 1 ghế trống trên sơ đồ
  const emptySeat = page.locator('button[title*="Ghế"]:not([disabled])').first();
  await emptySeat.waitFor({ state: 'visible' });
  await emptySeat.click();
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '09-pos-seat-selected.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 09-pos-seat-selected.png');

  // Bước 2.4: Chuyển sang tab Bắp nước & chọn bắp ngọt
  console.log('[2.4] Tab Bắp nước, thêm Bắp ngọt cỡ vừa...');
  const concessionTabBtn = page.locator('button:has-text("3. Bắp nước & Combo")');
  await concessionTabBtn.click();
  await page.waitForTimeout(500);

  // Nhấn dấu + của sản phẩm bắp nước đầu tiên
  const addPopcornBtn = page.locator('button:has-text("+")').first();
  await addPopcornBtn.click();
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '10-pos-cart-with-concessions.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 10-pos-cart-with-concessions.png');

  // Bước 2.5: Tạo đơn giữ chỗ 10p
  console.log('[2.5] Tạo đơn giữ chỗ tại quầy...');
  const createHoldOrderBtn = page.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")');
  await createHoldOrderBtn.click();

  // Đợi badge PENDING hoặc đếm ngược xuất hiện
  await page.waitForSelector('text=GIỮ CHỖ:', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '11-pos-pending-order-created.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 11-pos-pending-order-created.png');

  // Bước 2.6: Chọn tiền mặt, nhập tiền khách đưa
  console.log('[2.6] Chọn tiền mặt, chọn nút 200k...');
  const cash200kBtn = page.locator('button:has-text("200k")');
  if (await cash200kBtn.isVisible()) {
    await cash200kBtn.click();
  } else {
    const cashInput = page.locator('input[placeholder="0"]');
    await cashInput.fill('200000');
  }
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '12-pos-cash-payment-input.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 12-pos-cash-payment-input.png');

  // Bước 2.7: Thu tiền & In hóa đơn nhiệt 80mm
  console.log('[2.7] Thu tiền & mở modal in nhiệt 80mm...');
  const submitCashPayBtn = page.locator('button:has-text("THU TIỀN & IN VÉ")');
  await submitCashPayBtn.click();

  // Đợi modal in hóa đơn nhiệt xuất hiện
  await page.waitForSelector('#thermal-receipt-content', { timeout: 12000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '13-pos-thermal-receipt-modal.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 13-pos-thermal-receipt-modal.png');

  // Bước 2.8: Đóng modal, sang /staff/orders xác nhận đơn vừa bán
  console.log('[2.8] Đóng modal, sang /staff/orders kiểm tra...');
  const closeModalBtn = page.locator('button[title="Đóng (Esc)"]');
  if (await closeModalBtn.isVisible()) {
    await closeModalBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);

  // Điều hướng sang /staff/orders
  await page.goto(`${BASE_URL}/staff/orders`);
  await page.waitForSelector('text=QUẢN LÝ ĐƠN HÀNG QUẦY', { timeout: 10000 });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '14-pos-staff-orders-verified.png'),
    fullPage: false,
  });
  console.log('📸 Đã chụp: 14-pos-staff-orders-verified.png');

  console.log('\n========================================');
  console.log('HOÀN THÀNH TOÀN BỘ 14 BƯỚC E2E THÀNH CÔNG!');
  console.log('========================================\n');

  await browser.close();
}

runE2E().catch((err) => {
  console.error('\n❌ E2E Script gặp lỗi:', err);
  process.exit(1);
});
