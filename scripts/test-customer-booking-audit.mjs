import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve('A:/SE/project/class/CinemaManagement-WDP301/docs/plans/audit/evidence/customer-booking');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const BASE_URL = 'http://localhost:3333';

const mockShowtimeDetail = {
  showtimeId: 'st-online-001',
  movieId: 'mov-dune',
  movieTitle: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
  roomId: 'room-01',
  roomName: 'Phòng Chiếu 01 (IMAX Laser)',
  startTime: new Date(Date.now() + 3600000).toISOString(),
  endTime: new Date(Date.now() + 10800000).toISOString(),
  basePrice: 90000,
};

function generateSeats(reservedIds = [], bookedIds = []) {
  const rows = ['A', 'B', 'C', 'D'];
  const seats = [];
  for (const r of rows) {
    for (let c = 1; c <= 8; c++) {
      const seatShowtimeId = `sst-${r.toLowerCase()}${c}`;
      let status = 'EMPTY';
      if (reservedIds.includes(seatShowtimeId)) status = 'RESERVED';
      if (bookedIds.includes(seatShowtimeId)) status = 'BOOKED';

      seats.push({
        seatShowtimeId,
        showtimeId: 'st-online-001',
        seatId: `s-${r.toLowerCase()}${c}`,
        seatStatus: status,
        rowPosition: r,
        columnPosition: c,
        seatType: 'STANDARD',
        price: 90000,
      });
    }
  }
  return seats;
}

async function runCustomerAudit() {
  console.log('--- KHỞI ĐỘNG AUDIT E2E PLAYWRIGHT CUSTOMER BOOKING ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Mock API routes
  await page.route('**/showtimes/st-online-001', async (route) => {
    await route.fulfill({ json: mockShowtimeDetail });
  });

  await page.route('**/showtimes/st-online-001/seats', async (route) => {
    await route.fulfill({ json: generateSeats() });
  });

  let currentOrder = null;

  await page.route('**/orders/booking', async (route) => {
    currentOrder = {
      orderId: 'ord-online-999',
      totalAmount: 180000,
      discountAmount: 0,
      finalAmount: 180000,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      remainingSeconds: 600,
      showtimeId: 'st-online-001',
      movieTitle: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
      roomName: 'Phòng Chiếu 01 (IMAX Laser)',
      startTime: mockShowtimeDetail.startTime,
      seats: [
        { seatShowtimeId: 'sst-a1', rowPosition: 'A', columnPosition: 1, seatType: 'STANDARD', price: 90000 },
        { seatShowtimeId: 'sst-a2', rowPosition: 'A', columnPosition: 2, seatType: 'STANDARD', price: 90000 },
      ],
      products: [],
    };
    await route.fulfill({ json: currentOrder });
  });

  await page.route('**/orders/ord-online-999/summary', async (route) => {
    await route.fulfill({ json: currentOrder });
  });

  await page.route('**/orders/ord-online-999/apply-promotion', async (route) => {
    currentOrder.discountAmount = 36000;
    currentOrder.finalAmount = 144000;
    currentOrder.promotionCode = 'DISCOUNT20';
    await route.fulfill({
      json: currentOrder,
    });
  });

  // 1. Màn hình chọn ghế online
  console.log('Chụp ảnh 01: Sơ đồ ghế online...');
  await page.goto(`${BASE_URL}/booking/st-online-001`);
  await page.waitForLoadState('networkidle');

  // Chọn ghế A1, A2
  await page.locator('button[title*="Ghế A1"]').click();
  await page.locator('button[title*="Ghế A2"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_customer_seat_selection.png') });

  // 2. Bấm Tiếp tục đặt vé -> Màn hình tóm tắt đơn hàng
  console.log('Chụp ảnh 02: Tóm tắt đơn hàng...');
  await page.locator('button:has-text("Tiếp tục đặt vé")').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_customer_order_summary_pending.png') });

  // 3. Áp dụng mã giảm giá hợp lệ DISCOUNT20
  console.log('Chụp ảnh 03: Áp voucher hợp lệ...');
  const promoInput = page.locator('input[placeholder*="NHẬP MÃ GIẢM GIÁ"]');
  await promoInput.fill('DISCOUNT20');
  await page.locator('button:has-text("Áp dụng mã")').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_customer_voucher_applied.png') });

  // 4. Mở Modal thanh toán
  console.log('Chụp ảnh 04: Modal thanh toán...');
  const payBtn = page.locator('button:has-text("Tiến hành thanh toán")');
  if (await payBtn.isVisible()) {
    await payBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_customer_payment_modal.png') });
  }

  await browser.close();
  console.log('✅ Audit Customer Booking hoàn tất!');
}

runCustomerAudit().catch((err) => {
  console.error('Lỗi khi chạy Customer Audit:', err);
  process.exit(1);
});
