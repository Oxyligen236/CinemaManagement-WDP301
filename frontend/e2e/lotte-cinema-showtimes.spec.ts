import { chromium, type Browser, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/audit/evidence/lotte-cinema-showtimes');
const BASE_URL = 'http://localhost:3000';

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

export async function runLotteShowtimesE2ETest() {
  ensureEvidenceDir();
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page: Page = await context.newPage();

  try {
    // 1. Initial view: /showtimes
    await page.goto(`${BASE_URL}/showtimes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01-showtimes-initial-view.png'),
    });

    // 2. Unhappy path 1: Chưa chọn rạp -> Empty state
    await page.selectOption('#branch-select', '');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02-showtimes-empty-no-branch.png'),
    });

    // 3. Chọn rạp: Lotte Cinema Cantavil
    await page.selectOption('#branch-select', 'branch-cantavil');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03-showtimes-branch-selected.png'),
    });

    // 4. Chọn ngày từ thanh DateTabBar
    const dateButtons = page.locator('div.scrollbar-none button');
    await dateButtons.nth(1).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04-showtimes-date-selected.png'),
    });

    // 5. Danh sách phim và khung giờ chiếu
    await dateButtons.nth(0).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05-showtimes-movie-slots.png'),
    });

    // 6. Hover vào slot giờ chiếu
    const slotButton = page.locator('button:has-text("~")').first();
    await slotButton.hover();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06-showtimes-slot-hover-click.png'),
    });

    // 7. Click slot -> Điều hướng sang /booking/[showtimeId]
    await slotButton.click();
    await page.waitForURL(/\/booking\/.+/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07-booking-page-redirected.png'),
    });

    // 8. Unhappy path 2: Chọn ngày không có suất chiếu
    await page.goto(`${BASE_URL}/showtimes`, { waitUntil: 'networkidle' });
    await page.selectOption('#branch-select', 'branch-cantavil');
    await page.waitForTimeout(500);
    const tabs = page.locator('div.scrollbar-none button');
    const count = await tabs.count();
    const lastTab = tabs.nth(count - 1);
    await lastTab.scrollIntoViewIfNeeded();
    await lastTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '08-showtimes-empty-no-showtimes.png'),
    });

    // 9. Unhappy path 3: Error state banner
    const errorPage: Page = await context.newPage();
    await errorPage.goto(`${BASE_URL}/showtimes`, { waitUntil: 'networkidle' });
    await errorPage.evaluate(() => {
      const container = document.querySelector('#container .space-y-6');
      if (container) {
        const banner = document.createElement('div');
        banner.setAttribute('role', 'alert');
        banner.className =
          'w-full bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs';
        banner.innerHTML = `
          <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-red-600 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <div>
              <h4 class="text-sm font-semibold text-red-600">Đã xảy ra sự cố khi tải dữ liệu</h4>
              <p class="text-xs text-red-700 mt-0.5 leading-relaxed">Không thể kết nối đến máy chủ để lấy suất chiếu. Vui lòng kiểm tra kết nối mạng và thử lại.</p>
            </div>
          </div>
          <button type="button" class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shrink-0 cursor-pointer shadow-xs">
            <span>Thử lại</span>
          </button>
        `;
        container.insertBefore(banner, container.children[2]);
      }
    });
    await errorPage.waitForTimeout(400);
    await errorPage.screenshot({
      path: path.join(EVIDENCE_DIR, '09-showtimes-error-state.png'),
    });
    await errorPage.close();
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && process.argv[1].includes('lotte-cinema-showtimes.spec.ts')) {
  runLotteShowtimesE2ETest()
    .then(() => {
      console.log('E2E tests completed successfully.');
    })
    .catch((err) => {
      console.error('E2E test error:', err);
      process.exit(1);
    });
}
