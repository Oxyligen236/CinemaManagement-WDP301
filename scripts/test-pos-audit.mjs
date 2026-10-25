import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve('A:/SE/project/class/CinemaManagement-WDP301/docs/plans/audit/evidence/staff-ticket-booking');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const BASE_URL = 'http://localhost:3333';

const mockShowtimes = [
  {
    showtimeId: 'st-001',
    movieId: 'mov-dune',
    movieTitle: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
    moviePosterUrl: '',
    roomId: 'room-imax-1',
    roomName: 'Phòng Chiếu 01 (IMAX Laser)',
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 10800000).toISOString(),
    basePrice: 90000,
    format: 'IMAX 2D',
    subtitleType: 'Phụ đề Tiếng Việt',
  },
  {
    showtimeId: 'st-002',
    movieId: 'mov-oppenheimer',
    movieTitle: 'OPPENHEIMER',
    moviePosterUrl: '',
    roomId: 'room-02',
    roomName: 'Phòng Chiếu 02',
    startTime: new Date(Date.now() + 7200000).toISOString(),
    endTime: new Date(Date.now() + 14400000).toISOString(),
    basePrice: 80000,
    format: '2D Digital',
    subtitleType: 'Phụ đề Tiếng Việt',
  },
];

const mockCatalog = {
  branchId: 'branch-hn-01',
  items: [
    {
      itemId: 'item-popcorn',
      name: 'Bắp rang bơ Phô Mai',
      category: 'POPCORN',
      size: 'L',
      price: 65000,
      stockQuantity: 45,
    },
    {
      itemId: 'item-coca',
      name: 'Coca Cola Tươi 32oz',
      category: 'DRINK',
      size: '32oz',
      price: 25000,
      stockQuantity: 120,
    },
  ],
  combos: [
    {
      comboId: 'combo-solo',
      name: 'Combo Solo Đặc Biệt',
      price: 85000,
      availableStock: 25,
      items: [],
    },
  ],
};

function generateSeats(reservedIds = [], bookedIds = []) {
  const rows = ['E', 'F'];
  const seats = [];
  for (const r of rows) {
    for (let c = 1; c <= 8; c++) {
      const seatId = `s-${r.toLowerCase()}${c}`;
      const seatShowtimeId = `sst-${r.toLowerCase()}${c}`;
      let status = 'EMPTY';
      if (reservedIds.includes(seatShowtimeId)) status = 'RESERVED';
      if (bookedIds.includes(seatShowtimeId)) status = 'BOOKED';

      seats.push({
        seatShowtimeId,
        showtimeId: 'st-001',
        seatId,
        seatStatus: status,
        rowPosition: r,
        columnPosition: c,
        seatType: r === 'F' ? 'VIP' : 'STANDARD',
        price: r === 'F' ? 110000 : 90000,
      });
    }
  }
  return seats;
}

async function runAudit() {
  console.log('--- KHỞI ĐỘNG AUDIT E2E PLAYWRIGHT STAFF POS ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Setup localStorage token
  await context.addInitScript(() => {
    localStorage.setItem('access_token', 'mock_staff_token_audit');
    localStorage.setItem('cinema_access_token', 'mock_staff_token_audit');
  });

  // ==========================================
  // KỊCH BẢN 1: HAPPY CASE 1
  // Suất chiếu -> Ghế -> Bắp nước -> Tiền mặt (300k - thối 30k) -> In vé nhiệt
  // ==========================================
  console.log('\n[TEST 1] Chạy Happy Case 1: Tiền mặt + In vé nhiệt...');
  const page1 = await context.newPage();

  let seats1 = generateSeats();
  let currentOrder1 = null;

  await page1.route('**/staff/products', async (route) => {
    await route.fulfill({ json: mockCatalog });
  });

  await page1.route('**/showtimes*', async (route) => {
    await route.fulfill({ json: mockShowtimes });
  });

  await page1.route('**/showtimes/st-001/seats', async (route) => {
    await route.fulfill({ json: seats1 });
  });

  await page1.route('**/staff/pos/orders', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      seats1 = generateSeats(['sst-e5', 'sst-e6']);
      currentOrder1 = {
        orderId: 'ord-pos-001',
        orderCode: 'ORD-POS-1001',
        totalAmount: 270000,
        discountAmount: 0,
        finalAmount: 270000,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        remainingSeconds: 600,
        seats: [
          { seatShowtimeId: 'sst-e5', rowPosition: 'E', columnPosition: 5, seatType: 'STANDARD', price: 90000 },
          { seatShowtimeId: 'sst-e6', rowPosition: 'E', columnPosition: 6, seatType: 'STANDARD', price: 90000 },
        ],
        products: [
          { productId: 'item-popcorn', productName: 'Bắp rang bơ Phô Mai', quantity: 1, unitPrice: 65000, subTotal: 65000 },
          { productId: 'item-coca', productName: 'Coca Cola Tươi 32oz', quantity: 1, unitPrice: 25000, subTotal: 25000 },
        ],
        showtimeId: 'st-001',
        movieName: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
        roomName: 'Phòng Chiếu 01 (IMAX Laser)',
      };
      await route.fulfill({ json: currentOrder1 });
      return;
    }
    await route.continue();
  });

  await page1.route('**/staff/pos/orders/ord-pos-001/pay/cash', async (route) => {
    seats1 = generateSeats([], ['sst-e5', 'sst-e6']);
    await route.fulfill({
      json: {
        orderId: 'ord-pos-001',
        orderCode: 'ORD-POS-1001',
        totalAmount: 270000,
        cashReceived: 300000,
        changeAmount: 30000,
        status: 'PAID',
        tickets: [
          { ticketCode: 'TK-20261025-E5A91', seatName: 'E5', price: 90000 },
          { ticketCode: 'TK-20261025-E6B92', seatName: 'E6', price: 90000 },
        ],
      },
    });
  });

  await page1.route('**/staff/pos/orders/ord-pos-001/receipt', async (route) => {
    await route.fulfill({
      json: {
        orderId: 'ord-pos-001',
        orderCode: 'ORD-POS-1001',
        branchName: 'Hà Nội Cinema 01',
        branchAddress: 'Tầng 5, Vincom Metropolis, 29 Liễu Giai, Ba Đình, Hà Nội',
        cashierName: 'staff@mycast.vn',
        printedAt: '25/10/2026 19:35:00',
        movieTitle: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
        roomName: 'Phòng Chiếu 01 (IMAX Laser)',
        showDate: '25/10/2026',
        showtime: '19:30',
        seats: [
          { seatName: 'E5', seatType: 'STANDARD', price: 90000 },
          { seatName: 'E6', seatType: 'STANDARD', price: 90000 },
        ],
        concessions: [
          { name: 'Bắp rang bơ Phô Mai', quantity: 1, unitPrice: 65000, subTotal: 65000 },
          { name: 'Coca Cola Tươi 32oz', quantity: 1, unitPrice: 25000, subTotal: 25000 },
        ],
        subtotal: 270000,
        discount: 0,
        totalAmount: 270000,
        paymentMethod: 'TIỀN MẶT',
        cashReceived: 300000,
        changeAmount: 30000,
        tickets: [
          { ticketCode: 'TK-20261025-E5A91', seatName: 'E5', price: 90000 },
          { ticketCode: 'TK-20261025-E6B92', seatName: 'E6', price: 90000 },
        ],
      },
    });
  });

  page1.on('request', req => console.log('REQ:', req.method(), req.url()));
  page1.on('response', res => console.log('RES:', res.status(), res.url()));
  page1.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page1.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  await page1.goto(`${BASE_URL}/staff/pos`);
  await page1.waitForLoadState('networkidle');

  // Bước 1.1: Chọn suất chiếu
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '01_happy_select_showtime.png') });
  await page1.locator('h4:has-text("DUNE")').first().click();
  await page1.waitForTimeout(300);

  // Bước 1.2: Chọn ghế E5, E6
  await page1.locator('button[title*="Ghế E5"]').click();
  await page1.locator('button[title*="Ghế E6"]').click();
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '02_happy_select_seats.png') });

  // Bước 1.3: Thêm bắp nước
  await page1.locator('button:has-text("3. Bắp nước & Combo")').click();
  await page1.waitForTimeout(300);
  const popcornCard = page1.locator('text="Bắp rang bơ Phô Mai"').locator('xpath=ancestor::div[contains(@class, "border")][1]');
  await popcornCard.locator('button:has-text("+")').click();
  const cocaCard = page1.locator('text="Coca Cola Tươi 32oz"').locator('xpath=ancestor::div[contains(@class, "border")][1]');
  await cocaCard.locator('button:has-text("+")').click();
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '03_happy_select_concessions.png') });

  // Bước 1.4: Giữ chỗ & Tiếp tục
  await page1.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")').click();
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '04_happy_order_pending.png') });

  // Bước 1.5: Nhập tiền khách đưa 300.000₫
  const cashInput = page1.locator('input[type="number"][placeholder="0"]');
  await cashInput.fill('300000');
  await page1.waitForTimeout(300);
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '05_happy_cash_received_change.png') });

  // Bước 1.6: Bấm Thu tiền & In vé nhiệt
  await page1.locator('button:has-text("THU TIỀN & IN VÉ")').click();
  await page1.waitForTimeout(600);
  await page1.screenshot({ path: path.join(EVIDENCE_DIR, '06_happy_thermal_receipt_modal.png') });
  await page1.close();
  console.log('✅ Happy Case 1 hoàn tất, đã chụp 6 ảnh.');

  // ==========================================
  // KỊCH BẢN 2: HAPPY CASE 2
  // Chọn ghế -> Áp voucher hợp lệ (giảm 20k) -> Thanh toán QR -> Check status -> Hóa đơn
  // ==========================================
  console.log('\n[TEST 2] Chạy Happy Case 2: Voucher hợp lệ + Thanh toán QR...');
  const page2 = await context.newPage();

  let seats2 = generateSeats();
  let currentOrder2 = null;

  await page2.route('**/staff/products', async (route) => {
    await route.fulfill({ json: mockCatalog });
  });
  await page2.route('**/showtimes*', async (route) => {
    await route.fulfill({ json: mockShowtimes });
  });
  await page2.route('**/showtimes/st-001/seats', async (route) => {
    await route.fulfill({ json: seats2 });
  });

  await page2.route('**/staff/pos/orders', async (route) => {
    if (route.request().method() === 'POST') {
      seats2 = generateSeats(['sst-f8']);
      currentOrder2 = {
        orderId: 'ord-pos-002',
        orderCode: 'ORD-POS-1002',
        totalAmount: 110000,
        discountAmount: 0,
        finalAmount: 110000,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        remainingSeconds: 600,
        seats: [
          { seatShowtimeId: 'sst-f8', rowPosition: 'F', columnPosition: 8, seatType: 'VIP', price: 110000 },
        ],
        products: [],
        showtimeId: 'st-001',
        movieName: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
        roomName: 'Phòng Chiếu 01 (IMAX Laser)',
      };
      await route.fulfill({ json: currentOrder2 });
      return;
    }
    await route.continue();
  });

  await page2.route('**/staff/pos/orders/ord-pos-002/apply-promotion', async (route) => {
    currentOrder2.discountAmount = 20000;
    currentOrder2.finalAmount = 90000;
    currentOrder2.promotionCode = 'MYCAST20';
    await route.fulfill({ json: currentOrder2 });
  });

  await page2.route('**/staff/pos/orders/ord-pos-002/pay/qr', async (route) => {
    await route.fulfill({
      json: {
        orderId: 'ord-pos-002',
        qrCodeUrl: 'https://api.vietqr.io/image/970422-123456789-compact2.jpg?amount=90000&addInfo=MYCAST_POS1002',
        transactionCode: 'TXN-QR-889922',
        amount: 90000,
        paymentMethod: 'VNPAY',
      },
    });
  });

  await page2.route('**/staff/pos/orders/ord-pos-002/pay/status', async (route) => {
    seats2 = generateSeats([], ['sst-f8']);
    await route.fulfill({
      json: {
        orderId: 'ord-pos-002',
        status: 'PAID',
        isPaid: true,
        tickets: [{ ticketCode: 'TK-20261025-F8VIP', seatName: 'F8', price: 110000 }],
      },
    });
  });

  await page2.route('**/staff/pos/orders/ord-pos-002/receipt', async (route) => {
    await route.fulfill({
      json: {
        orderId: 'ord-pos-002',
        orderCode: 'ORD-POS-1002',
        branchName: 'Hà Nội Cinema 01',
        branchAddress: 'Tầng 5, Vincom Metropolis, 29 Liễu Giai, Ba Đình, Hà Nội',
        cashierName: 'staff@mycast.vn',
        printedAt: '25/10/2026 19:40:00',
        movieTitle: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
        roomName: 'Phòng Chiếu 01 (IMAX Laser)',
        showDate: '25/10/2026',
        showtime: '19:30',
        seats: [{ seatName: 'F8', seatType: 'VIP', price: 110000 }],
        concessions: [],
        subtotal: 110000,
        discount: 20000,
        totalAmount: 90000,
        paymentMethod: 'VNPAY_QR',
        tickets: [{ ticketCode: 'TK-20261025-F8VIP', seatName: 'F8', price: 110000 }],
      },
    });
  });

  await page2.goto(`${BASE_URL}/staff/pos`);
  await page2.waitForLoadState('networkidle');

  // Chọn suất chiếu
  await page2.locator('h4:has-text("DUNE")').first().click();
  await page2.waitForTimeout(300);

  // Chọn ghế F8 VIP
  await page2.locator('button[title*="Ghế F8"]').click();
  await page2.screenshot({ path: path.join(EVIDENCE_DIR, '07_happy2_select_vip_seat.png') });

  // Giữ chỗ
  await page2.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")').click();
  await page2.waitForTimeout(400);

  // Nhập voucher hợp lệ MYCAST20
  const voucherInput = page2.locator('input[placeholder*="GIAM20"]');
  await voucherInput.fill('MYCAST20');
  await page2.locator('button:has-text("Áp dụng")').click();
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(EVIDENCE_DIR, '08_happy2_voucher_applied.png') });

  // Chuyển sang thanh toán QR
  await page2.locator('button:has-text("CHUYỂN KHOẢN QR")').click();
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(EVIDENCE_DIR, '09_happy2_vietqr_code.png') });

  // Kiểm tra trạng thái thanh toán -> thành công
  await page2.locator('button:has-text("Kiểm tra trạng thái thanh toán")').click();
  await page2.waitForTimeout(600);
  await page2.screenshot({ path: path.join(EVIDENCE_DIR, '10_happy2_qr_receipt_modal.png') });
  await page2.close();
  console.log('✅ Happy Case 2 hoàn tất, đã chụp 4 ảnh.');

  // ==========================================
  // KỊCH BẢN 3: UNHAPPY CASE 1
  // Áp voucher không hợp lệ / hết hạn -> Lỗi banner + giữ nguyên đơn
  // ==========================================
  console.log('\n[TEST 3] Chạy Unhappy Case 1: Voucher không hợp lệ...');
  const page3 = await context.newPage();

  let seats3 = generateSeats();
  let currentOrder3 = null;

  await page3.route('**/staff/products', async (route) => {
    await route.fulfill({ json: mockCatalog });
  });
  await page3.route('**/showtimes*', async (route) => {
    await route.fulfill({ json: mockShowtimes });
  });
  await page3.route('**/showtimes/st-001/seats', async (route) => {
    await route.fulfill({ json: seats3 });
  });

  await page3.route('**/staff/pos/orders', async (route) => {
    seats3 = generateSeats(['sst-e5']);
    currentOrder3 = {
      orderId: 'ord-pos-003',
      orderCode: 'ORD-POS-1003',
      totalAmount: 90000,
      discountAmount: 0,
      finalAmount: 90000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      remainingSeconds: 600,
      seats: [{ seatShowtimeId: 'sst-e5', rowPosition: 'E', columnPosition: 5, seatType: 'STANDARD', price: 90000 }],
      products: [],
      showtimeId: 'st-001',
    };
    await route.fulfill({ json: currentOrder3 });
  });

  await page3.route('**/staff/pos/orders/ord-pos-003/apply-promotion', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 400,
        message: 'Mã giảm giá đã hết hạn sử dụng hoặc không hợp lệ',
        error: 'Bad Request',
      }),
    });
  });

  await page3.goto(`${BASE_URL}/staff/pos`);
  await page3.waitForLoadState('networkidle');

  await page3.locator('h4:has-text("DUNE")').first().click();
  await page3.waitForTimeout(300);
  await page3.locator('button[title*="Ghế E5"]').click();
  await page3.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")').click();
  await page3.waitForTimeout(400);

  // Nhập voucher hết hạn
  const voucherInput3 = page2.locator ? page3.locator('input[placeholder*="GIAM20"]') : page3.locator('input[placeholder*="GIAM20"]');
  await voucherInput3.fill('EXPIRED_VOUCHER');
  await page3.locator('button:has-text("Áp dụng")').click();
  await page3.waitForTimeout(500);

  // Chụp ảnh lỗi banner hiển thị và đơn giữ nguyên 90.000₫
  await page3.screenshot({ path: path.join(EVIDENCE_DIR, '11_unhappy1_invalid_voucher_error.png') });
  await page3.close();
  console.log('✅ Unhappy Case 1 hoàn tất, đã chụp 1 ảnh.');

  // ==========================================
  // KỊCH BẢN 4: UNHAPPY CASE 2
  // Khách đổi ý hủy đơn -> Hủy đơn -> Nhả ghế ngay lập tức (RESERVED -> EMPTY)
  // ==========================================
  console.log('\n[TEST 4] Chạy Unhappy Case 2: Hủy đơn quầy & Nhả ghế ngay...');
  const page4 = await context.newPage();

  let seats4 = generateSeats();
  let currentOrder4 = null;

  await page4.route('**/staff/products', async (route) => {
    await route.fulfill({ json: mockCatalog });
  });
  await page4.route('**/showtimes*', async (route) => {
    await route.fulfill({ json: mockShowtimes });
  });
  await page4.route('**/showtimes/st-001/seats', async (route) => {
    await route.fulfill({ json: seats4 });
  });

  await page4.route('**/staff/pos/orders', async (route) => {
    seats4 = generateSeats(['sst-e5', 'sst-e6']);
    currentOrder4 = {
      orderId: 'ord-pos-004',
      orderCode: 'ORD-POS-1004',
      totalAmount: 180000,
      discountAmount: 0,
      finalAmount: 180000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      remainingSeconds: 600,
      seats: [
        { seatShowtimeId: 'sst-e5', rowPosition: 'E', columnPosition: 5, seatType: 'STANDARD', price: 90000 },
        { seatShowtimeId: 'sst-e6', rowPosition: 'E', columnPosition: 6, seatType: 'STANDARD', price: 90000 },
      ],
      products: [],
      showtimeId: 'st-001',
    };
    await route.fulfill({ json: currentOrder4 });
  });

  await page4.route('**/staff/pos/orders/ord-pos-004/cancel', async (route) => {
    seats4 = generateSeats(); // Ghế trở về EMPTY
    await route.fulfill({
      json: {
        message: 'Đã hủy đơn hàng và nhả ghế thành công',
        orderId: 'ord-pos-004',
        status: 'CANCELLED',
      },
    });
  });

  await page4.goto(`${BASE_URL}/staff/pos`);
  await page4.waitForLoadState('networkidle');

  await page4.locator('h4:has-text("DUNE")').first().click();
  await page4.waitForTimeout(300);
  await page4.locator('button[title*="Ghế E5"]').click();
  await page4.locator('button[title*="Ghế E6"]').click();
  await page4.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")').click();
  await page4.waitForTimeout(400);

  // Bấm Hủy (Esc)
  await page4.locator('button:has-text("HỦY (Esc)")').click();
  await page4.waitForTimeout(300);
  await page4.screenshot({ path: path.join(EVIDENCE_DIR, '12_unhappy2_cancel_dialog.png') });

  // Xác nhận hủy đơn
  await page4.locator('button:has-text("Đồng ý hủy")').click();
  await page4.waitForTimeout(500);
  await page4.screenshot({ path: path.join(EVIDENCE_DIR, '13_unhappy2_order_cancelled_released.png') });
  await page4.close();
  console.log('✅ Unhappy Case 2 hoàn tất, đã chụp 2 ảnh.');

  // ==========================================
  // KỊCH BẢN 5: UNHAPPY CASE 3
  // Quá thời gian giữ ghế (Timeout) -> Tự động nhả ghế và reset đơn
  // ==========================================
  console.log('\n[TEST 5] Chạy Unhappy Case 3: Timeout 10 phút tự động nhả ghế...');
  const page5 = await context.newPage();

  let seats5 = generateSeats();
  let currentOrder5 = null;

  await page5.route('**/staff/products', async (route) => {
    await route.fulfill({ json: mockCatalog });
  });
  await page5.route('**/showtimes*', async (route) => {
    await route.fulfill({ json: mockShowtimes });
  });
  await page5.route('**/showtimes/st-001/seats', async (route) => {
    await route.fulfill({ json: seats5 });
  });

  await page5.route('**/staff/pos/orders', async (route) => {
    seats5 = generateSeats(['sst-e5']);
    currentOrder5 = {
      orderId: 'ord-pos-005',
      orderCode: 'ORD-POS-1005',
      totalAmount: 90000,
      discountAmount: 0,
      finalAmount: 90000,
      expiresAt: new Date(Date.now() + 2000).toISOString(),
      remainingSeconds: 2, // Chỉ còn 2 giây để test timeout
      seats: [{ seatShowtimeId: 'sst-e5', rowPosition: 'E', columnPosition: 5, seatType: 'STANDARD', price: 90000 }],
      products: [],
      showtimeId: 'st-001',
    };
    await route.fulfill({ json: currentOrder5 });
  });

  // Handle alert dialog when timeout occurs
  let alertMessage = '';
  page5.on('dialog', async (dialog) => {
    alertMessage = dialog.message();
    console.log('Dialog alert caught:', alertMessage);
    await dialog.accept();
  });

  await page5.goto(`${BASE_URL}/staff/pos`);
  await page5.waitForLoadState('networkidle');

  await page5.locator('h4:has-text("DUNE")').first().click();
  await page5.waitForTimeout(300);
  await page5.locator('button[title*="Ghế E5"]').click();
  await page5.locator('button:has-text("GIỮ CHỖ & TIẾP TỤC")').click();
  await page5.waitForTimeout(300);

  // Chụp lúc đếm ngược 00:02
  await page5.screenshot({ path: path.join(EVIDENCE_DIR, '14_unhappy3_countdown_almost_expired.png') });

  // Chờ 2.5s để countdown về 0 và trigger timeout
  await page5.waitForTimeout(2500);

  // Chụp màn hình sau khi tự động reset
  await page5.screenshot({ path: path.join(EVIDENCE_DIR, '15_unhappy3_timeout_reset.png') });
  await page5.close();
  console.log(`✅ Unhappy Case 3 hoàn tất. Dialog: "${alertMessage}", đã chụp 2 ảnh.`);

  await browser.close();
  console.log('\n--- TOÀN BỘ 5 KỊCH BẢN PLAYWRIGHT ĐÃ HOÀN TẤT VỚI 15 ẢNH BẰNG CHỨNG ---');
}

runAudit().catch((err) => {
  console.error('Lỗi khi chạy Audit E2E:', err);
  process.exit(1);
});
