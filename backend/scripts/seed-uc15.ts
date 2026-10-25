/**
 * Seed dữ liệu kiểm thử cho UC-15 (Manage Showtimes - Branch Manager).
 * - Idempotent: upsert theo id cố định, chạy lại không tạo trùng.
 * - Mọi bản ghi seed có id bắt đầu bằng `seed-uc15-`; dọn bằng: `ts-node scripts/seed-uc15.ts --clean`.
 * - Không đổi schema/index nên không gọi syncIndexes().
 * - Dữ liệu:
 *   + Chi nhánh A (3 phòng: 2 AVAILABLE + 1 MAINTENANCE) và chi nhánh B (1 phòng AVAILABLE), mỗi phòng 5 ghế.
 *   + Phim: 2 đang chiếu (120 và 166 phút) + 1 đã kết thúc (ENDED, isActive=false).
 *   + 3 suất chiếu tương lai ở chi nhánh A: có vé BOOKED, toàn ghế EMPTY, có ghế RESERVED.
 *   + Tài khoản (mật khẩu Password123!): manager-a-uc15@cinema.local (chi nhánh A),
 *     manager-b-uc15@cinema.local (chi nhánh B), manager-nobranch-uc15@cinema.local (chưa gán chi nhánh).
 * - Cần chạy seed-uc05.ts trước để có hệ số nhân giá (script chỉ cảnh báo nếu chưa có).
 *
 * Chạy: npx ts-node scripts/seed-uc15.ts
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { BranchStatus } from '../src/modules/branch/domain/enums/branch-status.enum';
import {
  Branch,
  BranchSchema,
} from '../src/modules/branch/domain/schemas/branch.schema';
import { MovieStatus } from '../src/modules/movie/domain/enums/movie-status.enum';
import {
  Movie,
  MovieSchema,
} from '../src/modules/movie/domain/schemas/movie.schema';
import {
  SeatPriceRule,
  SeatPriceRuleSchema,
} from '../src/modules/pricerule/domain/schemas/seat-price-rule.schema';
import { RoomStatus } from '../src/modules/room/domain/enums/room-status.enum';
import { SeatStatus } from '../src/modules/room/domain/enums/seat-status.enum';
import { SeatType } from '../src/modules/room/domain/enums/seat-type.enum';
import {
  Room,
  RoomSchema,
} from '../src/modules/room/domain/schemas/room.schema';
import {
  Seat,
  SeatSchema,
} from '../src/modules/room/domain/schemas/seat.schema';
import { SeatShowtimeStatus } from '../src/modules/showtime/domain/enums/seat-showtime-status.enum';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from '../src/modules/showtime/domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeSchema,
} from '../src/modules/showtime/domain/schemas/showtime.schema';
import { Role } from '../src/modules/user/domain/enums/role.enum';
import {
  User,
  UserSchema,
} from '../src/modules/user/domain/schemas/user.schema';

const P = 'seed-uc15-';
const PASSWORD = 'Password123!';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

const SEAT_LAYOUT: [string, number, SeatType][] = [
  ['A', 1, SeatType.STANDARD],
  ['A', 2, SeatType.STANDARD],
  ['B', 1, SeatType.VIP],
  ['B', 2, SeatType.VIP],
  ['C', 1, SeatType.COUPLE],
];

/** 00:00 giờ VN của hôm nay (đổi ra UTC) cộng thêm số ngày và giờ VN. */
function vnTime(daysAhead: number, hourVn: number): Date {
  const vnNow = new Date(Date.now() + VN_OFFSET_MS);
  const midnightUtc =
    Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()) -
    VN_OFFSET_MS;
  return new Date(midnightUtc + daysAhead * DAY_MS + hourVn * HOUR_MS);
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // dùng biến môi trường có sẵn
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu MONGODB_URI');

  await mongoose.connect(uri);
  const BranchM = mongoose.model(Branch.name, BranchSchema);
  const RoomM = mongoose.model(Room.name, RoomSchema);
  const SeatM = mongoose.model(Seat.name, SeatSchema);
  const MovieM = mongoose.model(Movie.name, MovieSchema);
  const ShowtimeM = mongoose.model(Showtime.name, ShowtimeSchema);
  const SeatShowtimeM = mongoose.model(SeatShowtime.name, SeatShowtimeSchema);
  const UserM = mongoose.model(User.name, UserSchema);
  const SeatRuleM = mongoose.model(SeatPriceRule.name, SeatPriceRuleSchema);

  const rx = new RegExp(`^${P}`);

  if (process.argv.includes('--clean')) {
    const r = await Promise.all([
      SeatShowtimeM.deleteMany({ seatShowtimeId: rx }),
      ShowtimeM.deleteMany({ showtimeId: rx }),
      SeatM.deleteMany({ seatId: rx }),
      RoomM.deleteMany({ roomId: rx }),
      MovieM.deleteMany({ movieId: rx }),
      BranchM.deleteMany({ branchId: rx }),
      UserM.deleteMany({ userId: rx }),
    ]);
    console.log(
      'Đã xoá (seat showtimes, showtimes, seats, rooms, movies, branches, users):',
      r.map((x) => x.deletedCount),
    );
    await mongoose.disconnect();
    return;
  }

  if ((await SeatRuleM.countDocuments({})) === 0) {
    console.warn(
      'Cảnh báo: chưa có hệ số nhân giá ghế (seat_price_rules rỗng). ' +
        'Hãy chạy `npx ts-node scripts/seed-uc05.ts` trước để chọn hệ số khi tạo suất chiếu.',
    );
  }

  // 1. Chi nhánh
  const branches: [string, string, string][] = [
    ['a', 'Chi nhánh A (UC15)', '1 Nguyễn Huệ, Quận 1, TP.HCM'],
    ['b', 'Chi nhánh B (UC15)', '2 Lê Lợi, Quận 3, TP.HCM'],
  ];
  for (const [k, branchName, address] of branches) {
    await BranchM.updateOne(
      { branchId: `${P}branch-${k}` },
      { $set: { branchName, address, branchStatus: BranchStatus.ACTIVE } },
      { upsert: true },
    );
  }

  // 2. Phòng và ghế
  const rooms: [string, string, RoomStatus, string][] = [
    ['a1', 'Phòng 1', RoomStatus.AVAILABLE, 'a'],
    ['a2', 'Phòng 2', RoomStatus.AVAILABLE, 'a'],
    ['a3', 'Phòng 3 (bảo trì)', RoomStatus.MAINTENANCE, 'a'],
    ['b1', 'Phòng B1', RoomStatus.AVAILABLE, 'b'],
  ];
  for (const [k, roomName, roomStatus, branch] of rooms) {
    const roomId = `${P}room-${k}`;
    await RoomM.updateOne(
      { roomId },
      { $set: { roomName, roomStatus, branchId: `${P}branch-${branch}` } },
      { upsert: true },
    );
    for (const [row, col, seatType] of SEAT_LAYOUT) {
      await SeatM.updateOne(
        { seatId: `${P}seat-${k}-${row}${col}` },
        {
          $set: {
            roomId,
            rowPosition: row,
            columnPosition: col,
            seatType,
            status: SeatStatus.AVAILABLE,
          },
        },
        { upsert: true },
      );
    }
  }

  // 3. Phim
  const movies: [string, string, number, MovieStatus, boolean][] = [
    ['1', 'Phim UC15 - 120 phút', 120, MovieStatus.NOW_SHOWING, true],
    ['2', 'Phim UC15 - 166 phút', 166, MovieStatus.NOW_SHOWING, true],
    ['ended', 'Phim UC15 - Đã kết thúc', 100, MovieStatus.ENDED, false],
  ];
  for (const [k, movieName, duration, status, isActive] of movies) {
    await MovieM.updateOne(
      { movieId: `${P}movie-${k}` },
      { $set: { movieName, duration, status, isActive, genreIds: [] } },
      { upsert: true },
    );
  }

  // 4. Suất chiếu tương lai ở chi nhánh A và trạng thái ghế
  const showtimes: {
    k: string;
    movie: string;
    duration: number;
    room: string;
    days: number;
    hour: number;
    marks: Record<string, SeatShowtimeStatus>;
  }[] = [
    {
      k: 'booked',
      movie: '1',
      duration: 120,
      room: 'a1',
      days: 2,
      hour: 10,
      marks: { A1: SeatShowtimeStatus.BOOKED },
    },
    {
      k: 'empty',
      movie: '2',
      duration: 166,
      room: 'a2',
      days: 2,
      hour: 14,
      marks: {},
    },
    {
      k: 'reserved',
      movie: '2',
      duration: 166,
      room: 'a1',
      days: 3,
      hour: 10,
      marks: { B1: SeatShowtimeStatus.RESERVED },
    },
  ];
  for (const s of showtimes) {
    const showtimeId = `${P}showtime-${s.k}`;
    const startTime = vnTime(s.days, s.hour);
    await ShowtimeM.updateOne(
      { showtimeId },
      {
        $set: {
          movieId: `${P}movie-${s.movie}`,
          roomId: `${P}room-${s.room}`,
          startTime,
          endTime: new Date(startTime.getTime() + s.duration * MIN_MS),
          basePrice: 75000,
        },
        $setOnInsert: { seatPriceSelections: [], dayPriceSelections: [] },
      },
      { upsert: true },
    );
    for (const [row, col] of SEAT_LAYOUT) {
      const label = `${row}${col}`;
      await SeatShowtimeM.updateOne(
        { seatShowtimeId: `${P}ss-${s.k}-${label}` },
        {
          $set: {
            showtimeId,
            seatId: `${P}seat-${s.room}-${label}`,
          },
          // Giữ nguyên trạng thái ghế khi chạy lại
          $setOnInsert: {
            seatStatus: s.marks[label] ?? SeatShowtimeStatus.EMPTY,
          },
        },
        { upsert: true },
      );
    }
  }

  // 5. Tài khoản Manager
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: [string, string, string, string | undefined][] = [
    ['manager-a', 'manager-a-uc15@cinema.local', 'ManagerA', 'a'],
    ['manager-b', 'manager-b-uc15@cinema.local', 'ManagerB', 'b'],
    [
      'manager-nobranch',
      'manager-nobranch-uc15@cinema.local',
      'NoBranch',
      undefined,
    ],
  ];
  for (const [k, email, lastName, branch] of users) {
    // Không ghi đè tài khoản đã có (theo email)
    if (await UserM.exists({ email })) continue;
    await UserM.create({
      userId: P + k,
      email,
      password: passwordHash,
      firstName: 'UC15',
      lastName,
      role: Role.BRANCHMANAGER,
      isActive: true,
      ...(branch ? { branchId: `${P}branch-${branch}` } : {}),
    });
  }

  console.log(
    'Seed xong: 2 chi nhánh, 4 phòng, 3 phim, 3 suất chiếu (booked/empty/reserved), 3 tài khoản MANAGER.',
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
