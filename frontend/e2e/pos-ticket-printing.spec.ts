import { chromium, type Browser, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// @ts-expect-error Mongoose declaration file resolved from backend
import mongoose from '../../backend/node_modules/mongoose/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/plans/audit/evidence');
const MONGO_URI = 'mongodb://root:xkxoy%404%3A5%3D%40@kepter.id.vn:27017/wdp_project?authSource=admin';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

async function prepareDatabase() {
  await mongoose.connect(MONGO_URI);
  console.log('[DB] Connected to MongoDB');

  // Lấy branchId thực tế từ phòng chiếu (room.branchId)
  const sampleShowtime = await mongoose.connection.collection('showtimes').findOne({});
  const sampleRoom = await mongoose.connection.collection('rooms').findOne({ roomId: sampleShowtime?.roomId });
  const branchId = sampleRoom?.branchId || sampleShowtime?.branchId || 'seed-uc09-branch-1';
  console.log(`[DB] Using branchId: ${branchId} from room ${sampleRoom?.roomId} / showtime ${sampleShowtime?.showtimeId}`);

  // Đảm bảo staff@gmail.com có branchId khớp suất chiếu
  await mongoose.connection.collection('users').updateOne(
    { email: 'staff@gmail.com' },
    { $set: { branchId, isActive: true, role: 'STAFF' } }
  );

  // Đảm bảo có ít nhất 1 item F&B cho branch đó
  const now = new Date();
  await mongoose.connection.collection('items').updateOne(
    { itemId: 'seed-item-popcorn-01' },
    {
      $set: {
        itemId: 'seed-item-popcorn-01',
        branchId,
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
  return branchId;
}

async function runE2E() {
  ensureEvidenceDir();
  const branchId = await prepareDatabase();

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = await context.newPage();

  page.on('console', (msg) => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[BROWSER ERROR]', err.message));
  page.on('response', async (response) => {
    if (!response.ok()) {
      let body = '';
      try { body = await response.text(); } catch {}
      console.log('[RES ERROR]', response.status(), response.url(), body);
    }
  });

  console.log('\n======================================================');
  console.log('BẮT ĐẦU E2E: TEST IN TÁCH TỪNG VÉ CHO TỪNG GHẾ (POS)');
  console.log('======================================================\n');

  // Bước 1: Đăng nhập staff@gmail.com
  console.log('[1] Đăng nhập staff@gmail.com qua API...');
  const loginRes = await fetch('http://localhost:8010/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@gmail.com', password: '12345678' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.accessToken) {
    throw new Error('Đăng nhập thất bại: ' + JSON.stringify(loginData));
  }

  await page.goto(`${BASE_URL}/staff/pos`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user, branchId }) => {
    localStorage.setItem('cinema_access_token', token);
    localStorage.setItem('cinema_user', JSON.stringify({ ...user, branchId }));
  }, { token: loginData.accessToken, user: loginData.user, branchId });
  await page.reload({ waitUntil: 'networkidle' });
  console.log('[1] Đã xác thực token staff và tải xong POS.');

  // Bước 2: Chọn suất chiếu đầu tiên
  console.log('[2] Chọn suất chiếu...');
  const showtimeCard = page.locator('div[class*="border transition-all cursor-pointer"]:has-text("Phòng:")').first();
  await showtimeCard.waitFor({ state: 'visible', timeout: 10000 });
  await showtimeCard.click();

  // Đợi tab ghế xuất hiện
  await page.waitForSelector('button[title*="Ghế"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  // Bước 3: Chọn 2 ghế trống bất kỳ
  console.log('[3] Chọn 2 ghế trống trên sơ đồ...');
  const emptySeats = page.locator('button[title*="Ghế"]:not([disabled])');
  const count = await emptySeats.count();
  if (count < 2) {
    throw new Error('Không đủ ít nhất 2 ghế trống để test');
  }

  await emptySeats.nth(0).click();
  await page.waitForTimeout(400);
  await emptySeats.nth(1).click();
  await page.waitForTimeout(600);

  // Bước 4: Thêm Bắp nước (F&B) vào giỏ
  console.log('[4] Thêm bắp nước F&B...');
  const concessionTabBtn = page.locator('button:has-text("3. Bắp nước & Combo")');
  await concessionTabBtn.click();
  await page.waitForTimeout(500);

  const addPopcornBtn = page.locator('button:has-text("+")').first();
  if (await addPopcornBtn.isVisible()) {
    await addPopcornBtn.click();
    await page.waitForTimeout(600);
  }

  // Bước 5: Bấm Tạo đơn giữ chỗ
  console.log('[5] Giữ chỗ & Tiếp tục...');
  const createHoldOrderBtn = page.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")');
  await createHoldOrderBtn.click();

  await page.waitForSelector('text=GIỮ CHỖ:', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Bước 6: Thanh toán tiền mặt
  console.log('[6] Nhập tiền và thanh toán...');
  const cash500kBtn = page.locator('button:has-text("500k")');
  if (await cash500kBtn.isVisible()) {
    await cash500kBtn.click();
  } else {
    const cashInput = page.locator('input[placeholder="0"]');
    await cashInput.fill('500000');
  }
  await page.waitForTimeout(500);

  const submitCashPayBtn = page.locator('button:has-text("THU TIỀN & IN VÉ")');
  await submitCashPayBtn.click();

  // Bước 7: Xác thực Modal in nhiệt 80mm
  console.log('[7] Kiểm tra Modal In Nhiệt 80mm...');
  await page.waitForSelector('#thermal-receipt-content', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Chụp ảnh bằng chứng
  const screenshotPath = path.join(EVIDENCE_DIR, 'pos-multi-tickets-print.png');
  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
  });
  console.log(`📸 Đã lưu bằng chứng: ${screenshotPath}`);

  // Kiểm tra số lượng phiếu in (.thermal-page)
  const thermalPages = page.locator('#thermal-receipt-content .thermal-page');
  const pageCount = await thermalPages.count();
  console.log(`[VERIFY] Tổng số liên in được tạo (.thermal-page): ${pageCount}`);

  // Kỳ vọng: 1 Hóa đơn bán hàng + 2 Vé xem phim rời = 3 liên in
  if (pageCount < 3) {
    throw new Error(`Kỳ vọng ít nhất 3 liên in (1 bill + 2 vé), nhưng chỉ tìm thấy ${pageCount}`);
  }

  // Kiểm tra các thành phần trên từng vé
  const ticketTitles = page.locator('#thermal-receipt-content p:has-text("VÉ XEM PHIM")');
  const ticketCount = await ticketTitles.count();
  console.log(`[VERIFY] Số lượng vé xem phim riêng biệt có QR: ${ticketCount}`);

  const qrCodes = page.locator('#thermal-receipt-content svg');
  const qrCount = await qrCodes.count();
  console.log(`[VERIFY] Số lượng mã QR SVG độc lập: ${qrCount}`);

  if (qrCount < 2) {
    throw new Error(`Kỳ vọng ít nhất 2 QR Code cho 2 vé, thực tế tìm thấy ${qrCount}`);
  }

  console.log('\n======================================================');
  console.log('✅ TEST E2E IN TÁCH TỪNG VÉ CHO TỪNG GHẾ PASS 100%!');
  console.log('======================================================\n');

  await browser.close();
}

runE2E().catch((err) => {
  console.error('❌ E2E Test Thất Bại:', err);
  process.exit(1);
});
