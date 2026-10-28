/**
 * Seed dữ liệu phong phú phục vụ Public Showtimes & Branches cho Frontend.
 * - Idempotent: upsert theo ID cố định, chạy lại nhiều lần không tạo trùng.
 * - Hỗ trợ cờ `--clean` để xóa các bản ghi seed.
 * - 4 Chi nhánh rạp ACTIVE: Cantavil, Gò Vấp, Nam Sài Gòn, Landmark Hà Nội.
 * - Các phòng chiếu và danh sách ghế thực tế cho từng chi nhánh.
 * - 5 Phim đang chiếu với đầy đủ posterUrl, thời lượng, thể loại.
 * - Suất chiếu trải dài từ hôm nay đến 6 ngày tiếp theo (+0 .. +6).
 * - Dữ liệu ghế suất chiếu (SeatShowtime) với trạng thái EMPTY và BOOKED thực tế.
 *
 * Chạy: npx ts-node scripts/seed-showtimes-public.ts
 */
import mongoose from 'mongoose';
import { BranchStatus } from '../src/modules/branch/domain/enums/branch-status.enum';
import {
  Branch,
  BranchSchema,
} from '../src/modules/branch/domain/schemas/branch.schema';
import { MovieStatus } from '../src/modules/movie/domain/enums/movie-status.enum';
import {
  Genre,
  GenreSchema,
} from '../src/modules/movie/domain/schemas/genre.schema';
import {
  Movie,
  MovieSchema,
} from '../src/modules/movie/domain/schemas/movie.schema';
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

const SEED_PREFIX = 'seed-pub-';

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // dùng biến môi trường có sẵn
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Thiếu MONGODB_URI trong biến môi trường hoặc .env');
  }

  await mongoose.connect(uri);

  const BranchM = mongoose.model(Branch.name, BranchSchema);
  const RoomM = mongoose.model(Room.name, RoomSchema);
  const SeatM = mongoose.model(Seat.name, SeatSchema);
  const GenreM = mongoose.model(Genre.name, GenreSchema);
  const MovieM = mongoose.model(Movie.name, MovieSchema);
  const ShowtimeM = mongoose.model(Showtime.name, ShowtimeSchema);
  const SeatShowtimeM = mongoose.model(SeatShowtime.name, SeatShowtimeSchema);

  if (process.argv.includes('--clean')) {
    const rx = new RegExp(`^${SEED_PREFIX}`);
    const r = await Promise.all([
      SeatShowtimeM.deleteMany({ seatShowtimeId: rx }),
      ShowtimeM.deleteMany({ showtimeId: rx }),
      SeatM.deleteMany({ seatId: rx }),
      RoomM.deleteMany({ roomId: rx }),
      BranchM.deleteMany({
        branchId: {
          $in: [
            'branch-cantavil',
            'branch-govap',
            'branch-nam-sai-gon',
            'branch-landmark',
          ],
        },
      }),
      GenreM.deleteMany({ genreId: rx }),
      MovieM.deleteMany({
        movieId: { $in: ['12349', '12352', '12353', '12321', '12307'] },
      }),
    ]);
    console.log(
      'Đã xóa dữ liệu seed:',
      r.map((x) => x.deletedCount),
    );
    await mongoose.disconnect();
    return;
  }

  console.log('--- Bắt đầu seed Public Showtimes & Branches ---');

  // 1. Seed Branches
  const branches = [
    {
      branchId: 'branch-cantavil',
      branchName: 'Lotte Cinema Cantavil',
      address: 'Tầng 7, Cantavil Premier, An Phú, TP. Thủ Đức, TP.HCM',
      hotline: '028 3740 6180',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchId: 'branch-govap',
      branchName: 'Lotte Cinema Gò Vấp',
      address:
        'Tầng 3, Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng, P.10, Q. Gò Vấp, TP.HCM',
      hotline: '028 3620 2151',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchId: 'branch-nam-sai-gon',
      branchName: 'Lotte Cinema Nam Sài Gòn',
      address:
        'Tầng 3, Lotte Mart Nam Sài Gòn, 469 Nguyễn Hữu Thọ, P. Tân Hưng, Q.7, TP.HCM',
      hotline: '028 3775 2524',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchId: 'branch-landmark',
      branchName: 'Lotte Cinema Landmark Hà Nội',
      address:
        'Tầng 5, Keangnam Hanoi Landmark Tower, E6 Phạm Hùng, Q. Nam Từ Liêm, Hà Nội',
      hotline: '024 3837 8032',
      branchStatus: BranchStatus.ACTIVE,
    },
  ];

  for (const b of branches) {
    await BranchM.updateOne({ branchId: b.branchId }, { $set: b }, { upsert: true });
  }
  console.log(`✓ Đã seed ${branches.length} chi nhánh`);

  // 2. Seed Genres
  const genres = [
    { genreId: `${SEED_PREFIX}g-horror`, genreName: 'Kinh Dị' },
    { genreId: `${SEED_PREFIX}g-thriller`, genreName: 'Giật Gân' },
    { genreId: `${SEED_PREFIX}g-action`, genreName: 'Hành Động' },
    { genreId: `${SEED_PREFIX}g-music`, genreName: 'Âm Nhạc' },
    { genreId: `${SEED_PREFIX}g-detective`, genreName: 'Trinh Thám' },
    { genreId: `${SEED_PREFIX}g-comedy`, genreName: 'Hài' },
    { genreId: `${SEED_PREFIX}g-family`, genreName: 'Gia Đình' },
  ];

  for (const g of genres) {
    await GenreM.updateOne({ genreId: g.genreId }, { $set: g }, { upsert: true });
  }
  console.log(`✓ Đã seed ${genres.length} thể loại`);

  // 3. Seed Movies
  const movies = [
    {
      movieId: '12349',
      movieName: 'TRẠI BUÔN NGƯỜI',
      duration: 135,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Bộ phim kinh dị giật gân hồi hộp được mong chờ nhất mùa thu.',
      posterUrl: '/sites/lottecinemavn/posters/12349_101_100002.jpg',
      genreIds: [`${SEED_PREFIX}g-horror`, `${SEED_PREFIX}g-thriller`],
      isActive: true,
    },
    {
      movieId: '12352',
      movieName: 'QUỶ ĂN TẠNG 4: HỔ TINH',
      duration: 111,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Cơn ác mộng kinh hoàng trở lại với sự xuất hiện của Hổ Tinh nghìn năm.',
      posterUrl: '/sites/lottecinemavn/posters/12352_101_100003.jpg',
      genreIds: [`${SEED_PREFIX}g-horror`, `${SEED_PREFIX}g-action`],
      isActive: true,
    },
    {
      movieId: '12353',
      movieName: 'BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING',
      duration: 195,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Trực tiếp buổi hòa nhạc bùng nổ của BTS tại sân vận động Buenos Aires.',
      posterUrl: '/sites/lottecinemavn/posters/12353_101_100002.jpg',
      genreIds: [`${SEED_PREFIX}g-music`],
      isActive: true,
    },
    {
      movieId: '12321',
      movieName: 'ÁN MẠNG XÉM HOÀN HẢO',
      duration: 124,
      status: MovieStatus.NOW_SHOWING,
      description: 'Một cái bẫy tinh vi, một cuộc đấu trí không khoan nhượng.',
      posterUrl: '/sites/lottecinemavn/posters/12321_101_100003.jpg',
      genreIds: [`${SEED_PREFIX}g-detective`, `${SEED_PREFIX}g-thriller`],
      isActive: true,
    },
    {
      movieId: '12307',
      movieName: 'ÚT LAN 2',
      duration: 107,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Tiếng cười rộn rã và những khoảnh khắc cảm động của đại gia đình Út Lan.',
      posterUrl: '/sites/lottecinemavn/posters/12307_101_100002.jpg',
      genreIds: [`${SEED_PREFIX}g-comedy`, `${SEED_PREFIX}g-family`],
      isActive: true,
    },
  ];

  for (const m of movies) {
    await MovieM.updateOne({ movieId: m.movieId }, { $set: m }, { upsert: true });
  }
  console.log(`✓ Đã seed ${movies.length} phim đang chiếu`);

  // 4. Seed Rooms & Seats cho từng chi nhánh
  const allRooms: { roomId: string; roomName: string; branchId: string }[] = [];
  const roomOps = [];
  const seatOps = [];

  for (const b of branches) {
    const roomConfigs = [
      { num: '01', name: 'Cinema 01 (2D Phụ Đề)' },
      { num: '02', name: 'Cinema 02 (ScreenX)' },
    ];

    for (const rc of roomConfigs) {
      const roomId = `${SEED_PREFIX}room-${b.branchId}-${rc.num}`;
      allRooms.push({ roomId, roomName: rc.name, branchId: b.branchId });

      roomOps.push({
        updateOne: {
          filter: { roomId },
          update: {
            $set: {
              roomId,
              roomName: rc.name,
              branchId: b.branchId,
              roomStatus: RoomStatus.AVAILABLE,
            },
          },
          upsert: true,
        },
      });

      // Tạo ghế: 4 hàng (A, B, C, D) x 8 cột (1 .. 8) = 32 ghế
      const rows = ['A', 'B', 'C', 'D'];
      for (const row of rows) {
        for (let col = 1; col <= 8; col++) {
          const seatId = `${SEED_PREFIX}seat-${roomId}-${row}${col}`;
          const seatType =
            row === 'D'
              ? SeatType.COUPLE
              : row === 'C'
                ? SeatType.VIP
                : SeatType.STANDARD;

          seatOps.push({
            updateOne: {
              filter: { seatId },
              update: {
                $set: {
                  seatId,
                  roomId,
                  rowPosition: row,
                  columnPosition: col,
                  seatType,
                  status: SeatStatus.AVAILABLE,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }
  }

  if (roomOps.length > 0) await RoomM.bulkWrite(roomOps);
  if (seatOps.length > 0) await SeatM.bulkWrite(seatOps);
  console.log(
    `✓ Đã seed ${allRooms.length} phòng chiếu và ${seatOps.length} ghế ngồi`,
  );

  // 5. Seed Showtimes & SeatShowtimes trải dài 7 ngày (hôm nay + 0..6 ngày)
  const now = new Date();
  const showtimeOps = [];
  const seatShowtimeOps = [];

  const timeSlots = [
    { startH: 9, startM: 0, price: 80000 },
    { startH: 12, startM: 30, price: 90000 },
    { startH: 15, startM: 45, price: 95000 },
    { startH: 19, startM: 0, price: 110000 },
    { startH: 22, startM: 15, price: 100000 },
  ];

  for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const d = targetDate.getDate();

    for (let rIdx = 0; rIdx < allRooms.length; rIdx++) {
      const room = allRooms[rIdx];

      for (let sIdx = 0; sIdx < timeSlots.length; sIdx++) {
        const slot = timeSlots[sIdx];
        const movie = movies[(rIdx + sIdx + dayOffset) % movies.length];
        const showtimeId = `${SEED_PREFIX}st-${room.roomId}-d${dayOffset}-s${sIdx}`;

        const startTime = new Date(Date.UTC(y, m, d, slot.startH, slot.startM, 0, 0));
        const endTime = new Date(
          startTime.getTime() + (movie.duration + 15) * 60 * 1000,
        );

        showtimeOps.push({
          updateOne: {
            filter: { showtimeId },
            update: {
              $set: {
                showtimeId,
                movieId: movie.movieId,
                roomId: room.roomId,
                startTime,
                endTime,
                basePrice: slot.price,
                seatPriceSelections: [],
                dayPriceSelections: [],
              },
            },
            upsert: true,
          },
        });

        // Tạo SeatShowtime cho 32 ghế của phòng này
        const rows = ['A', 'B', 'C', 'D'];
        for (const row of rows) {
          for (let col = 1; col <= 8; col++) {
            const seatId = `${SEED_PREFIX}seat-${room.roomId}-${row}${col}`;
            const seatShowtimeId = `${SEED_PREFIX}ss-${showtimeId}-${row}${col}`;
            // 15% ghế được đặt sẵn để có dữ liệu thực tế
            const isBooked = (col + sIdx + dayOffset) % 7 === 0;
            const seatStatus = isBooked
              ? SeatShowtimeStatus.BOOKED
              : SeatShowtimeStatus.EMPTY;

            seatShowtimeOps.push({
              updateOne: {
                filter: { seatShowtimeId },
                update: {
                  $set: {
                    seatShowtimeId,
                    showtimeId,
                    seatId,
                    seatStatus,
                  },
                },
                upsert: true,
              },
            });
          }
        }
      }
    }
  }

  if (showtimeOps.length > 0) await ShowtimeM.bulkWrite(showtimeOps);
  if (seatShowtimeOps.length > 0) await SeatShowtimeM.bulkWrite(seatShowtimeOps);

  console.log(
    `✓ Đã seed ${showtimeOps.length} suất chiếu và ${seatShowtimeOps.length} trạng thái ghế suất chiếu`,
  );
  console.log('--- Hoàn thành seed Public Showtimes & Branches thành công! ---');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
