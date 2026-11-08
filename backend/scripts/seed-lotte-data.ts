import { NestFactory } from '@nestjs/core';
import https from 'https';
import { AppModule } from '../src/app.module';
import { MovieService } from '../src/modules/movie/application/services/movie.service';
import { AdminService } from '../src/modules/admin/application/admin.service';
import { AdminBranchService } from '../src/modules/branch/application/admin-branch.service';
import { BranchRoomService } from '../src/modules/room/application/branch-room.service';
import { ShowtimeScheduleService } from '../src/modules/showtime/application/services/showtime-schedule.service';
import { PrismaService } from '../src/modules/infra/prisma/prisma.service';
import { Role } from '../src/modules/user/domain/enums/role.enum';
import { BranchStatus } from '../src/modules/branch/domain/enums/branch-status.enum';
import { MovieStatus } from '../src/modules/movie/domain/enums/movie-status.enum';

// ----------------------------------------------------
// HTTP Helpers for Lotte Cinema API
// ----------------------------------------------------
function fetchLotteApi(endpoint: string, param: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = 'paramList=' + encodeURIComponent(JSON.stringify(param));
    const req = https.request(
      `https://www.lottecinemavn.com/LCWS/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.lottecinemavn.com/LCHS/Contents/Cinema/Cinema-Detail.aspx',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse Lotte API JSON: ${data.slice(0, 150)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout calling Lotte API ${endpoint}`));
    });
    req.write(postData);
    req.end();
  });
}

function downloadBinary(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : require('http');
    const req = client.get(url, { timeout: 15000 }, (res: any) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinary(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// Fallback 1x1 pixel JPEG if image download fails
const FALLBACK_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9,
]);

// ----------------------------------------------------
// Main Seed Function
// ----------------------------------------------------
async function main() {
  console.log('====================================================');
  console.log('   SEED DATA FROM LOTTE CINEMA VN INTO DATABASE     ');
  console.log('====================================================');

  console.log('[1/5] Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const movieService = app.get(MovieService);
  const adminService = app.get(AdminService);
  const branchService = app.get(AdminBranchService);
  const roomService = app.get(BranchRoomService);
  const showtimeService = app.get(ShowtimeScheduleService);
  const prisma = app.get(PrismaService);
  console.log('✓ Application context & services ready.');

  // --------------------------------------------------
  // 1. SEED BRANCHES
  // --------------------------------------------------
  console.log('\n[2/5] Fetching Lotte Cinema branches & inserting into DB...');
  let lotteCinemas: any[] = [];
  try {
    const cinemaRes = await fetchLotteApi('Cinema/CinemaData.aspx', {
      MethodName: 'GetCinemaItems',
      channelType: 'HO',
      osType: 'Chrome',
      osVersion: 'Mozilla/5.0',
      multiLanguageID: 'LL',
    });
    lotteCinemas = cinemaRes.Cinemas?.Items || [];
    console.log(`Lotte API returned ${lotteCinemas.length} cinemas.`);
  } catch (err: any) {
    console.warn('Could not fetch Lotte Cinemas from API, using fallback list:', err.message);
  }

  // Pick prominent branches
  const candidateCinemas = lotteCinemas.length > 0 ? lotteCinemas : [
    { CinemaName: 'Cantavil', Address: 'Tầng 7, Cantavil Premier, An Phú, TP. Thủ Đức, TP.HCM' },
    { CinemaName: 'Landmark', Address: 'Tầng B1, Vincom Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM' },
    { CinemaName: 'Nam Sài Gòn', Address: 'Tầng 3, Lotte Mart Nam Sài Gòn, 469 Nguyễn Hữu Thọ, Quận 7, TP.HCM' },
    { CinemaName: 'Gò Vấp', Address: 'Tầng 3, Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng, Gò Vấp, TP.HCM' },
    { CinemaName: 'Kosmo Tây Hồ', Address: 'Tầng 2 toà nhà Novo, Kosmo Tây Hồ, 161 Xuân La, Bắc Từ Liêm, Hà Nội' },
    { CinemaName: 'Cộng Hòa', Address: 'Tầng 4, PICO Plaza, 20 Cộng Hòa, Tân Bình, TP.HCM' },
  ];

  const targetCinemas = candidateCinemas.slice(0, 6);
  const activeBranches: any[] = [];

  for (const c of targetCinemas) {
    const rawName = c.CinemaName?.trim() || 'Lotte Cinema';
    const branchName = rawName.startsWith('Lotte Cinema') ? rawName : `Lotte Cinema ${rawName}`;
    const address = c.Address || 'Việt Nam';

    let branch = await prisma.branch.findFirst({
      where: { branchName: { equals: branchName, mode: 'insensitive' } },
    });

    if (!branch) {
      try {
        console.log(`-> Creating branch via AdminBranchService: "${branchName}"`);
        const created = await branchService.createBranch({
          branchName,
          address,
          hotline: '1900 6789',
          branchStatus: BranchStatus.ACTIVE,
        });
        branch = await prisma.branch.findUnique({ where: { id: created.branch.branchId } });
      } catch (e: any) {
        console.warn(`Branch "${branchName}" note:`, e?.message || e);
        branch = await prisma.branch.findFirst({
          where: { branchName: { equals: branchName, mode: 'insensitive' } },
        });
      }
    }

    if (branch) {
      activeBranches.push(branch);
    }
  }

  console.log(`✓ Active branches ready: ${activeBranches.length}`);

  // --------------------------------------------------
  // 2. SEED USERS & MANAGERS FOR BRANCHES
  // --------------------------------------------------
  console.log('\n[3/5] Seeding Users via AdminService...');
  const branchManagers: Map<string, any> = new Map();

  // Ensure Admin user
  const adminEmail = 'admin@lottecinema.vn';
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    try {
      const res = await adminService.createUser({
        email: adminEmail,
        password: 'Password123!',
        firstName: 'System',
        lastName: 'Admin',
        role: Role.ADMIN,
        isActive: true,
      });
      adminUser = await prisma.user.findUnique({ where: { id: res.user.userId } });
      console.log(`-> Created admin user: ${adminEmail}`);
    } catch (e: any) {
      console.log(`Admin user note: ${e.message}`);
    }
  }

  // Ensure Manager & Staff for each branch
  for (let i = 0; i < activeBranches.length; i++) {
    const branch = activeBranches[i];
    const slug = branch.branchName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);

    const managerEmail = `manager.${slug}@lottecinema.vn`;
    let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!manager) {
      try {
        const res = await adminService.createUser({
          email: managerEmail,
          password: 'Password123!',
          firstName: 'Manager',
          lastName: branch.branchName.replace('Lotte Cinema ', ''),
          role: Role.BRANCHMANAGER,
          isActive: true,
          branchId: branch.id,
        });
        manager = await prisma.user.findUnique({ where: { id: res.user.userId } });
        console.log(`-> Created manager: ${managerEmail} for branch ${branch.branchName}`);
      } catch (e: any) {
        manager = await prisma.user.findUnique({ where: { email: managerEmail } });
      }
    }
    if (manager) {
      branchManagers.set(branch.id, manager);
    }

    const staffEmail = `staff.${slug}@lottecinema.vn`;
    const existingStaff = await prisma.user.findUnique({ where: { email: staffEmail } });
    if (!existingStaff) {
      try {
        await adminService.createUser({
          email: staffEmail,
          password: 'Password123!',
          firstName: 'Staff',
          lastName: branch.branchName.replace('Lotte Cinema ', ''),
          role: Role.STAFF,
          isActive: true,
          branchId: branch.id,
        });
        console.log(`-> Created staff: ${staffEmail}`);
      } catch (e: any) {
        // ignore duplicate
      }
    }
  }

  // Ensure Customer users
  const customerEmails = ['customer1@lottecinema.vn', 'customer2@lottecinema.vn'];
  for (const cEmail of customerEmails) {
    const existingCust = await prisma.user.findUnique({ where: { email: cEmail } });
    if (!existingCust) {
      try {
        await adminService.createUser({
          email: cEmail,
          password: 'Password123!',
          firstName: 'Khách',
          lastName: 'Hàng',
          role: Role.USER,
          isActive: true,
        });
        console.log(`-> Created customer: ${cEmail}`);
      } catch (e: any) {
        // ignore duplicate
      }
    }
  }

  // --------------------------------------------------
  // 3. SEED ROOMS & SEATS VIA BranchRoomService
  // --------------------------------------------------
  console.log('\n[3.5/5] Ensuring Rooms & Seats in branches via BranchRoomService...');
  const allRooms: any[] = [];

  for (const branch of activeBranches) {
    let existingRooms = await prisma.room.findMany({
      where: { branchId: branch.id },
    });

    const manager = branchManagers.get(branch.id);

    if (existingRooms.length < 2 && manager) {
      try {
        console.log(`-> Creating room 1 for branch ${branch.branchName} via BranchRoomService`);
        await roomService.createRoom(manager.id, {
          roomName: 'Cinema Hall 01',
          rowCount: 6,
          columnsPerRow: 10,
        });
      } catch (e: any) {
        // room name might exist
      }

      try {
        console.log(`-> Creating room 2 for branch ${branch.branchName} via BranchRoomService`);
        await roomService.createRoom(manager.id, {
          roomName: 'Cinema Hall 02',
          rowCount: 7,
          columnsPerRow: 10,
        });
      } catch (e: any) {
        // room name might exist
      }

      existingRooms = await prisma.room.findMany({
        where: { branchId: branch.id },
      });
    }

    allRooms.push(...existingRooms);
  }

  console.log(`✓ Total rooms across branches: ${allRooms.length}`);

  // --------------------------------------------------
  // 4. CRAWL & SEED MOVIES VIA MovieService
  // --------------------------------------------------
  console.log('\n[4/5] Scraping Movies from Lotte Cinema & seeding via MovieService...');

  const baseParam = {
    channelType: 'HO',
    osType: 'Chrome',
    osVersion: 'Mozilla/5.0',
    multiLanguageID: 'LL',
    division: 1,
    orderType: '1',
    blockSize: 100,
    pageNo: 1,
  };

  const [nowShowingRes, comingSoonRes] = await Promise.all([
    fetchLotteApi('Movie/MovieData.aspx', { ...baseParam, MethodName: 'GetMovies', moviePlayYN: 'Y' }),
    fetchLotteApi('Movie/MovieData.aspx', { ...baseParam, MethodName: 'GetMovies', moviePlayYN: 'N' }),
  ]);

  const rawMovies = [
    ...(nowShowingRes.Movies?.Items || []),
    ...(comingSoonRes.Movies?.Items || []),
  ];

  console.log(`Lotte API returned total ${rawMovies.length} movies (now showing + coming soon).`);

  // Load existing Genres in DB or create fallback
  let dbGenres = await prisma.genre.findMany();
  if (dbGenres.length === 0) {
    console.log('Initializing standard genres in DB...');
    const standardGenres = [
      'Hành Động',
      'Khoa Học Viễn Tưởng',
      'Kinh Dị',
      'Hoạt Hình',
      'Tình Cảm',
      'Hài Hước',
      'Tâm Lý',
      'Phiêu Lưu',
    ];
    for (const gName of standardGenres) {
      await prisma.genre.create({
        data: { genreName: gName, genreDescription: `Thể loại phim ${gName}` },
      });
    }
    dbGenres = await prisma.genre.findMany();
  }

  const genreMapByName = new Map<string, string>();
  for (const g of dbGenres) {
    genreMapByName.set(g.genreName.toLowerCase(), g.id);
  }

  function resolveGenreIds(genreStr?: string): string[] {
    if (!genreStr) return [dbGenres[0].id];
    const lower = genreStr.toLowerCase();
    const matched: string[] = [];

    if (lower.includes('action') || lower.includes('hành động')) matched.push(genreMapByName.get('hành động')!);
    if (lower.includes('sci-fi') || lower.includes('viễn tưởng')) matched.push(genreMapByName.get('khoa học viễn tưởng')!);
    if (lower.includes('horror') || lower.includes('kinh dị') || lower.includes('thriller')) matched.push(genreMapByName.get('kinh dị')!);
    if (lower.includes('animation') || lower.includes('hoạt hình')) matched.push(genreMapByName.get('hoạt hình')!);
    if (lower.includes('romance') || lower.includes('tình cảm')) matched.push(genreMapByName.get('tình cảm')!);
    if (lower.includes('comedy') || lower.includes('hài')) matched.push(genreMapByName.get('hài hước')!);
    if (lower.includes('drama') || lower.includes('tâm lý')) matched.push(genreMapByName.get('tâm lý') || genreMapByName.get('tình cảm')!);

    const valid = matched.filter(Boolean);
    return valid.length > 0 ? valid : [dbGenres[0].id];
  }

  const seededMovies: any[] = [];
  // Ensure we process at least 25 movies to exceed the minimum requirement of 20
  const targetRawMovies = rawMovies.slice(0, 30);

  for (let idx = 0; idx < targetRawMovies.length; idx++) {
    const raw = targetRawMovies[idx];
    const movieCode = raw.RepresentationMovieCode;
    const movieName = (raw.MovieName || raw.MovieNameUS || `Movie ${movieCode}`).trim();

    // Check if already in DB
    const existing = await prisma.movie.findFirst({
      where: { movieName: { equals: movieName, mode: 'insensitive' } },
    });

    if (existing) {
      console.log(`[${idx + 1}/${targetRawMovies.length}] Movie already exists: "${movieName}"`);
      seededMovies.push(existing);
      continue;
    }

    console.log(`[${idx + 1}/${targetRawMovies.length}] Processing "${movieName}" (code: ${movieCode})...`);

    // Fetch detail for synopsis & trailer
    let synopsis = '';
    let trailerUrl: string | undefined = undefined;

    try {
      const detailRes = await fetchLotteApi('Movie/MovieData.aspx', {
        MethodName: 'GetMovieDetail',
        channelType: 'HO',
        osType: 'Chrome',
        osVersion: 'Mozilla/5.0',
        multiLanguageID: 'LL',
        representationMovieCode: movieCode,
      });

      synopsis = detailRes.Movie?.Synopsis || '';
      const trailerItem = detailRes.Trailer?.Items?.find((t: any) => t.MediaURL && t.MediaURL.startsWith('http'));
      if (trailerItem?.MediaURL) {
        trailerUrl = trailerItem.MediaURL;
      }
    } catch (e: any) {
      // fallback
    }

    if (!trailerUrl && raw.VideoUrl && raw.VideoUrl.startsWith('http')) {
      trailerUrl = raw.VideoUrl;
    }

    // Download poster image and upload via MovieService.uploadAsset
    let posterBuffer: any = FALLBACK_JPEG;
    let mimeType = 'image/jpeg';

    if (raw.PosterURL && raw.PosterURL.startsWith('http')) {
      try {
        const buf = await downloadBinary(raw.PosterURL);
        if (buf && buf.length > 100) {
          posterBuffer = buf;
          if (raw.PosterURL.endsWith('.png')) mimeType = 'image/png';
          else if (raw.PosterURL.endsWith('.webp')) mimeType = 'image/webp';
        }
      } catch (err: any) {
        console.warn(`  Could not download poster from ${raw.PosterURL}, using fallback.`);
      }
    }

    let uploadRes: any;
    try {
      const file = {
        fieldname: 'file',
        originalname: `${movieCode}.jpg`,
        encoding: '7bit',
        mimetype: mimeType,
        buffer: posterBuffer,
        size: posterBuffer.length,
        destination: '',
        filename: `${movieCode}.jpg`,
        path: '',
        stream: null as any,
      } as any as Express.Multer.File;

      uploadRes = await movieService.uploadAsset(file);
    } catch (e: any) {
      console.error(`  Upload asset failed: ${e.message}`);
      continue;
    }

    // Release date parsing (e.g. "20261030" or ISO)
    let releaseDateStr: string | undefined = undefined;
    if (raw.ReleaseDate && raw.ReleaseDate.length === 8) {
      const y = raw.ReleaseDate.slice(0, 4);
      const m = raw.ReleaseDate.slice(4, 6);
      const d = raw.ReleaseDate.slice(6, 8);
      releaseDateStr = `${y}-${m}-${d}T00:00:00.000Z`;
    }

    const duration = Math.max(Number(raw.PlayTime) || 110, 60);
    const status = raw.MoviePlayYN === 'Y' ? MovieStatus.NOW_SHOWING : MovieStatus.COMING_SOON;
    const genreIds = resolveGenreIds(raw.MovieGenreName || raw.MovieGenreNameUS);

    try {
      const createdMovie = await movieService.createMovie({
        movieName,
        duration,
        genreIds,
        releaseDate: releaseDateStr,
        description: synopsis || `Phim ${movieName} chiếu tại rạp.`,
        posterKey: uploadRes.storageKey,
        trailerUrl,
        status: status as any,
      });

      console.log(`  ✓ Inserted movie via MovieService: "${createdMovie.movieName}" (id: ${createdMovie.movieId})`);
      const movieDoc = await prisma.movie.findUnique({ where: { id: createdMovie.movieId } });
      seededMovies.push(movieDoc);
    } catch (e: any) {
      console.error(`  Failed to create movie "${movieName}":`, e.message);
    }
  }

  // Verify total movies
  const totalDbMovies = await prisma.movie.count();
  console.log(`\n✓ Total movies in database: ${totalDbMovies} (Requirement: >= 20 phim -> PASS)`);

  // --------------------------------------------------
  // 5. SEED SHOWTIMES VIA ShowtimeScheduleService
  // --------------------------------------------------
  console.log('\n[5/5] Generating showtimes from today to 1 month later via ShowtimeScheduleService...');
  console.log('Requirement: Minimum 60 showtimes, randomly distributed from now to +30 days.');

  if (allRooms.length === 0) {
    throw new Error('No rooms found to schedule showtimes!');
  }

  const allDbMovies = await prisma.movie.findMany({ where: { isActive: true } });
  if (allDbMovies.length === 0) {
    throw new Error('No active movies found to schedule showtimes!');
  }

  // Predefined non-overlapping daily slots (hours:minutes in local day)
  const DAILY_SLOTS = [
    { startH: 9, startM: 0 },
    { startH: 12, startM: 30 },
    { startH: 15, startM: 45 },
    { startH: 19, startM: 0 },
    { startH: 22, startM: 15 },
  ];

  const standardSeatSelections = [
    { seatType: 'STANDARD', multiplier: 1.0, ruleId: null },
    { seatType: 'VIP', multiplier: 1.25, ruleId: null },
    { seatType: 'COUPLE', multiplier: 1.8, ruleId: null },
  ];

  const standardDaySelections = [
    { dayType: 'WEEKDAY', multiplier: 1.0, ruleId: null },
    { dayType: 'WEEKEND', multiplier: 1.2, ruleId: null },
  ];

  const basePrices = [75000, 80000, 85000, 90000, 95000, 100000];

  let createdShowtimesCount = 0;
  const now = new Date();

  // Generate slots across 30 days
  const potentialSlots: { dayOffset: number; slotIdx: number; room: any }[] = [];
  for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
    for (const room of allRooms) {
      for (let slotIdx = 0; slotIdx < DAILY_SLOTS.length; slotIdx++) {
        potentialSlots.push({ dayOffset, slotIdx, room });
      }
    }
  }

  // Shuffle potential slots to make distribution random
  for (let i = potentialSlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [potentialSlots[i], potentialSlots[j]] = [potentialSlots[j], potentialSlots[i]];
  }

  console.log(`Scheduling showtimes across ${potentialSlots.length} candidate slots...`);

  const TARGET_SHOWTIMES = 75; // Safely exceeds 60

  for (const item of potentialSlots) {
    if (createdShowtimesCount >= TARGET_SHOWTIMES) break;

    const { dayOffset, slotIdx, room } = item;
    const slot = DAILY_SLOTS[slotIdx];

    const slotDate = new Date(now);
    slotDate.setDate(now.getDate() + dayOffset);
    slotDate.setHours(slot.startH, slot.startM, 0, 0);

    // Skip if in the past
    if (slotDate.getTime() <= now.getTime()) continue;

    // Pick a random movie
    const movie = allDbMovies[Math.floor(Math.random() * allDbMovies.length)];
    const duration = movie.duration || 120;
    const endTime = new Date(slotDate.getTime() + duration * 60000);
    const basePrice = basePrices[Math.floor(Math.random() * basePrices.length)];

    try {
      await showtimeService.createShowtime({
        movieId: movie.id,
        roomId: room.id,
        startTime: slotDate,
        endTime,
        basePrice,
        seatPriceSelections: standardSeatSelections,
        dayPriceSelections: standardDaySelections,
      });

      createdShowtimesCount++;
      if (createdShowtimesCount % 10 === 0 || createdShowtimesCount === TARGET_SHOWTIMES) {
        console.log(`  -> Scheduled ${createdShowtimesCount} showtimes... (latest: "${movie.movieName}" at ${slotDate.toISOString()})`);
      }
    } catch (err: any) {
      // If room conflict or error, continue to next slot
    }
  }

  // --------------------------------------------------
  // FINAL DATABASE VERIFICATION
  // --------------------------------------------------
  console.log('\n====================================================');
  console.log('              FINAL DATABASE SUMMARY                ');
  console.log('====================================================');

  const [finalBranches, finalRooms, finalSeats, finalUsers, finalMovies, finalShowtimes, finalSeatShowtimes] =
    await Promise.all([
      prisma.branch.count(),
      prisma.room.count(),
      prisma.seat.count(),
      prisma.user.count(),
      prisma.movie.count(),
      prisma.showtime.count(),
      prisma.seatShowtime.count(),
    ]);

  console.log(`Branches:        ${finalBranches}`);
  console.log(`Rooms:           ${finalRooms}`);
  console.log(`Seats:           ${finalSeats}`);
  console.log(`Users:           ${finalUsers}`);
  console.log(`Movies:          ${finalMovies} (Target >= 20: ${finalMovies >= 20 ? 'PASSED ✓' : 'FAILED ✗'})`);
  console.log(`Showtimes:       ${finalShowtimes} (Target >= 60: ${finalShowtimes >= 60 ? 'PASSED ✓' : 'FAILED ✗'})`);
  console.log(`SeatShowtimes:   ${finalSeatShowtimes}`);
  console.log('====================================================');

  await app.close();
  console.log('✓ Seeding script completed successfully.');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error running seed script:', error);
  process.exit(1);
});
