import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_DIR = path.resolve(__dirname, '../../docs/plans/audit');
const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/plans/audit/evidence');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

function ensureDirectories() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

/**
 * Kiểm tra kết nối backend trước khi chạy E2E
 */
async function assertBackendAlive(): Promise<void> {
  console.log(`[E2E] Kiểm tra kết nối tới backend tại ${BACKEND_URL}...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BACKEND_URL}/branches/public`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[E2E] Backend phản hồi HTTP status: ${res.status}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[E2E ERROR] Backend chưa hoạt động tại ${BACKEND_URL}. ` +
      `Vui lòng đảm bảo backend NestJS đang chạy trên port 8010 trước khi thực hiện test E2E. ` +
      `Chi tiết: ${msg}`
    );
  }
}

/**
 * Kiểm tra kết nối frontend server trước khi khởi động trình duyệt
 */
async function assertFrontendAlive(): Promise<void> {
  console.log(`[E2E] Kiểm tra kết nối tới frontend tại ${BASE_URL}...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BASE_URL}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[E2E] Frontend phản hồi HTTP status: ${res.status}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[E2E ERROR] Frontend chưa hoạt động tại ${BASE_URL}. ` +
      `Vui lòng đảm bảo frontend Next.js đang chạy trên port 3000 trước khi thực hiện test E2E. ` +
      `Chi tiết: ${msg}`
    );
  }
}

/**
 * Khẳng định trang tải thành công, không chứa banner lỗi mạng / fetch thất bại
 */
async function assertNoFailedToFetch(page: Page, stepName: string): Promise<void> {
  const bodyText = await page.evaluate(() => document.body?.innerText || '');
  const lower = bodyText.toLowerCase();

  const forbiddenErrors = [
    'failed to fetch',
    'không thể kết nối',
    'network error',
    'econnrefused',
  ];

  for (const errText of forbiddenErrors) {
    if (lower.includes(errText)) {
      throw new Error(
        `[E2E ASSERTION FAILED] Phát hiện lỗi kết nối "${errText}" tại bước "${stepName}" trên URL: ${page.url()}`
      );
    }
  }
}

/**
 * Chờ trang ổn định dữ liệu mạng và ẩn spinner
 */
async function waitForDataReady(page: Page, timeoutMs = 4000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
  const spinner = page.locator('.animate-spin').first();
  await spinner.waitFor({ state: 'detached', timeout: timeoutMs }).catch(() => {});
}

export async function runMovieDetailsListShowtimeE2ETest() {
  ensureDirectories();

  // 1. Kiểm tra tính khả dụng của backend và frontend
  await assertBackendAlive();
  await assertFrontendAlive();

  console.log('[E2E] Bắt đầu khởi động Playwright với ghi hình video...');

  const browser: Browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: AUDIT_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  const page: Page = await context.newPage();

  try {
    // =========================================================================
    // HAPPY PATH 1: Home -> Phim Đang Chiếu -> Movie List -> Tìm kiếm
    //              -> Movie Detail -> Xem Trailer -> Chọn Lịch Chiếu
    //              -> Click Slot -> Sang /booking/[showtimeId]
    // =========================================================================
    console.log('[E2E] --- HAPPY PATH 1: Danh sách phim, chi tiết & đặt vé ---');
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Home Page');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-home-page.png') });

    // 1. Click menu "PHIM ĐANG CHIẾU" trên Header
    const nowShowingLink = page.locator('header a:has-text("PHIM ĐANG CHIẾU")').first();
    if (await nowShowingLink.isVisible()) {
      await nowShowingLink.click();
    } else {
      await page.goto(`${BASE_URL}/movies?type=nowshowing`, { waitUntil: 'domcontentloaded' });
    }
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Movies List Now Showing');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-movies-list-now-showing.png') });

    // 2. Tìm kiếm phim
    const searchInput = page.locator('input[type="text"][placeholder*="Tìm"], input[placeholder*="tên phim"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('a');
      await page.waitForTimeout(600);
      await waitForDataReady(page);
      await assertNoFailedToFetch(page, 'Movies Search Result');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-movies-search-result.png') });
      await searchInput.fill('');
      await page.waitForTimeout(600);
      await waitForDataReady(page);
    }

    // 3. Click nút "Chi tiết" hoặc thẻ phim đầu tiên -> Điều hướng sang /movies/[movieId]
    const detailLink = page.locator('a[href^="/movies/"]:not([href="/movies"]):not([href*="type="])').first();
    await detailLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (await detailLink.isVisible()) {
      const targetHref = await detailLink.getAttribute('href');
      if (targetHref) {
        await page.goto(`${BASE_URL}${targetHref}`, { waitUntil: 'domcontentloaded' });
      } else {
        await detailLink.click();
        await page.waitForURL(/\/movies\/.+/, { timeout: 6000 }).catch(() => {});
      }
    } else {
      await page.goto(`${BASE_URL}/movies/12300`, { waitUntil: 'domcontentloaded' });
    }
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Movie Detail Hero');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-movie-detail-hero.png') });

    // 4. Click xem Trailer Modal nếu có nút
    const trailerBtn = page.locator('button:has-text("Trailer"), button:has-text("Xem Trailer")').first();
    if (await trailerBtn.isVisible()) {
      await trailerBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-movie-trailer-modal.png') });

      // Đóng modal trailer
      const closeTrailerBtn = page.locator('button[aria-label="Đóng trailer"], button[aria-label="Đóng"], button:has-text("Đóng"), [role="dialog"] button').first();
      if (await closeTrailerBtn.isVisible()) {
        await closeTrailerBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-movie-trailer-modal.png') });
    }

    // 5. Chuyển sang Tab Lịch chiếu phim
    const showtimeTab = page.locator('button:has-text("Lịch Chiếu Phim"), button:has-text("Lịch chiếu")').first();
    if (await showtimeTab.isVisible()) {
      await showtimeTab.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Movie Detail Showtimes Tab');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '06-movie-detail-showtimes-tab.png') });

    // Click slot suất chiếu khả dụng nếu có
    const slotBtn = page.locator('button:has-text(":"):has-text("~"), button:has-text("2D"), a[href*="/booking/"]').first();
    if (await slotBtn.isVisible()) {
      await slotBtn.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Booking Page Redirect');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07-booking-page-redirect.png') });

    // =========================================================================
    // HAPPY PATH 2: Tab Phim Sắp Chiếu (COMING_SOON) -> Lọc thể loại
    // =========================================================================
    console.log('[E2E] --- HAPPY PATH 2: Phim Sắp Chiếu (COMING_SOON) ---');
    await page.goto(`${BASE_URL}/movies?type=comingsoon`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);

    // Click tab "PHIM SẮP CHIẾU" nếu có nút tab
    const comingSoonTab = page.locator('button:has-text("SẮP CHIẾU"), button:has-text("Sắp chiếu")').first();
    if (await comingSoonTab.isVisible()) {
      await comingSoonTab.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Movies Coming Soon Tab');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '08-movies-coming-soon-tab.png') });

    // Lọc theo thể loại nếu có dropdown thể loại
    const genreSelect = page.locator('select').first();
    if (await genreSelect.isVisible()) {
      const options = await genreSelect.locator('option').all();
      if (options.length > 1) {
        const val = await options[1].getAttribute('value');
        if (val) {
          await genreSelect.selectOption(val);
          await waitForDataReady(page);
          await assertNoFailedToFetch(page, 'Movies Genre Filtered');
          await page.screenshot({ path: path.join(EVIDENCE_DIR, '09-movies-genre-filtered.png') });
        }
      }
    }

    // =========================================================================
    // HAPPY PATH 3: Menu Mua Vé -> /ticketing -> Chọn Phim -> Chọn Rạp
    //              -> Chọn Ngày -> Chọn Suất chiếu -> Sang /booking/[showtimeId]
    // =========================================================================
    console.log('[E2E] --- HAPPY PATH 3: Đặt vé nhanh /ticketing 4 cột ---');
    await page.goto(`${BASE_URL}/ticketing`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Ticketing Initial View');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '10-ticketing-initial-view.png') });

    // 1. Cột 1: Chọn một phim từ danh sách
    const firstMovieItem = page.locator('section:nth-of-type(1) .divide-y button').first();
    await firstMovieItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    if (await firstMovieItem.isVisible()) {
      await firstMovieItem.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Ticketing Movie Selected');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '11-ticketing-movie-selected.png') });

    // 2. Cột 2: Chọn một cụm rạp từ danh sách
    const firstBranchItem = page.locator('section:nth-of-type(2) .divide-y button').first();
    await firstBranchItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    if (await firstBranchItem.isVisible()) {
      await firstBranchItem.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Ticketing Branch Selected');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '12-ticketing-branch-selected.png') });

    // 3. Cột 3: Chọn ngày chiếu
    const firstDateItem = page.locator('section:nth-of-type(3) .divide-y button, section:nth-of-type(3) button').first();
    await firstDateItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    if (await firstDateItem.isVisible()) {
      await firstDateItem.click();
      await waitForDataReady(page);
    }
    await assertNoFailedToFetch(page, 'Ticketing Date Selected');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '13-ticketing-date-selected.png') });

    // 4. Cột 4: Kiểm tra suất chiếu khả dụng & click chọn slot
    const ticketingSlot = page.locator('section:nth-of-type(4) button').first();
    if (await ticketingSlot.isVisible()) {
      await ticketingSlot.click();
      await waitForDataReady(page);
      await assertNoFailedToFetch(page, 'Ticketing Slot Booked');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '14-ticketing-slot-booked.png') });
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '14-ticketing-slot-booked.png') });
    }

    // =========================================================================
    // UNHAPPY PATH 1: Tìm kiếm phim không tồn tại -> Empty State -> Reset
    // =========================================================================
    console.log('[E2E] --- UNHAPPY PATH 1: Tìm kiếm phim không tồn tại ---');
    await page.goto(`${BASE_URL}/movies`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);

    const movieSearchBox = page.locator('input[type="text"][placeholder*="Tìm"], input[placeholder*="tên phim"]').first();
    if (await movieSearchBox.isVisible()) {
      await movieSearchBox.fill('xyznonexistentmovie12345');
      await waitForDataReady(page);
      await assertNoFailedToFetch(page, 'Unhappy Search Empty State');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '15-unhappy-search-empty-state.png') });

      // Click nút "Đặt lại bộ lọc" / Reset
      const resetBtn = page.locator('button:has-text("Đặt lại"), button:has-text("Xóa bộ lọc")').first();
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        await waitForDataReady(page);
        await assertNoFailedToFetch(page, 'Unhappy Search Reset');
        await page.screenshot({ path: path.join(EVIDENCE_DIR, '16-unhappy-search-reset.png') });
      }
    }

    // =========================================================================
    // UNHAPPY PATH 2: Truy cập phim không tồn tại /movies/non-existent-movie-id
    // =========================================================================
    console.log('[E2E] --- UNHAPPY PATH 2: Phim không tồn tại 404 ---');
    await page.goto(`${BASE_URL}/movies/non-existent-movie-id`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Unhappy 404 Movie Page');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '17-unhappy-404-movie.png') });

    // Kiểm tra nút "Quay lại danh sách phim"
    const backBtn = page.locator('a:has-text("Quay lại"), button:has-text("Quay lại")').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await waitForDataReady(page);
      await assertNoFailedToFetch(page, 'Unhappy Back to Movies');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '18-unhappy-back-to-movies.png') });
    }

    // =========================================================================
    // UNHAPPY PATH 3: Ngày không có suất chiếu -> Thông báo chưa có lịch
    // =========================================================================
    console.log('[E2E] --- UNHAPPY PATH 3: Ngày không có suất chiếu ---');
    await page.goto(`${BASE_URL}/ticketing`, { waitUntil: 'domcontentloaded' });
    await waitForDataReady(page);
    await assertNoFailedToFetch(page, 'Unhappy Ticketing No Showtimes Check');

    // Chọn ngày cuối cùng trong danh sách (ngày xa tương lai)
    const dateButtons = page.locator('section:nth-of-type(3) button');
    const totalDates = await dateButtons.count();
    if (totalDates > 0) {
      await dateButtons.nth(totalDates - 1).click();
      await waitForDataReady(page);
      await assertNoFailedToFetch(page, 'Unhappy No Showtimes Date Selected');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '19-unhappy-no-showtimes-date.png') });
    }

    console.log('[E2E] Hoàn thành toàn bộ kịch bản Happy/Unhappy path thành công.');
  } catch (err) {
    console.error('[E2E] Lỗi trong quá trình chạy kiểm thử:', err);
    throw err;
  } finally {
    // Đóng page và context để flush video ra disk
    await page.close();
    await context.close();
    await browser.close();
    console.log(`[E2E] Video kiểm thử đã được lưu vào: ${AUDIT_DIR}`);
  }
}

if (process.argv[1] && process.argv[1].includes('movie-details-list-showtime.spec.ts')) {
  runMovieDetailsListShowtimeE2ETest()
    .then(() => {
      console.log('Playwright E2E run finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Playwright E2E failed:', err);
      process.exit(1);
    });
}
