/**
 * Seed dữ liệu mẫu cho UC-09 (Quản lý phim).
 * - Idempotent: upsert theo ID cố định, chạy lại nhiều lần không tạo trùng.
 * - Mọi bản ghi có ID bắt đầu bằng `seed-uc09-` để dễ dọn: `ts-node scripts/seed-uc09.ts --clean`
 *
 * Chạy: npx ts-node scripts/seed-uc09.ts
 */
import mongoose from 'mongoose';
import { Genre, GenreSchema } from '../src/modules/movie/domain/schemas/genre.schema';
import { Movie, MovieSchema } from '../src/modules/movie/domain/schemas/movie.schema';
import { MovieStatus } from '../src/modules/movie/domain/enums/movie-status.enum';
import { Showtime, ShowtimeSchema } from '../src/modules/showtime/domain/schemas/showtime.schema';
import { Room, RoomSchema } from '../src/modules/room/domain/schemas/room.schema';
import { RoomStatus } from '../src/modules/room/domain/enums/room-status.enum';
import { Branch, BranchSchema } from '../src/modules/branch/domain/schemas/branch.schema';
import { BranchStatus } from '../src/modules/branch/domain/enums/branch-status.enum';

const P = 'seed-uc09-';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // dùng biến môi trường có sẵn
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu MONGODB_URI');

  await mongoose.connect(uri);
  const GenreM = mongoose.model(Genre.name, GenreSchema);
  const MovieM = mongoose.model(Movie.name, MovieSchema);
  const ShowtimeM = mongoose.model(Showtime.name, ShowtimeSchema);
  const RoomM = mongoose.model(Room.name, RoomSchema);
  const BranchM = mongoose.model(Branch.name, BranchSchema);

  const rx = new RegExp(`^${P}`);

  if (process.argv.includes('--clean')) {
    const r = await Promise.all([
      ShowtimeM.deleteMany({ showtimeId: rx }),
      MovieM.deleteMany({ movieId: rx }),
      GenreM.deleteMany({ genreId: rx }),
      RoomM.deleteMany({ roomId: rx }),
      BranchM.deleteMany({ branchId: rx }),
    ]);
    console.log('Đã xoá:', r.map((x) => x.deletedCount));
    await mongoose.disconnect();
    return;
  }

  // Thể loại
  const genres = [
    ['action', 'Hành động'],
    ['comedy', 'Hài'],
    ['horror', 'Kinh dị'],
    ['romance', 'Tình cảm'],
    ['animation', 'Hoạt hình'],
  ];
  for (const [k, name] of genres) {
    await GenreM.updateOne(
      { genreId: P + k },
      { $set: { genreName: name, genreDescription: `Phim thể loại ${name}` } },
      { upsert: true },
    );
  }

  // Chi nhánh + phòng (showtime cần roomId)
  await BranchM.updateOne(
    { branchId: P + 'branch-1' },
    { $set: { branchName: 'CGV Seed Quận 1', address: '1 Nguyễn Huệ, Q1, TP.HCM', branchStatus: BranchStatus.ACTIVE } },
    { upsert: true },
  );
  for (const n of [1, 2]) {
    await RoomM.updateOne(
      { roomId: P + `room-${n}` },
      { $set: { roomName: `Phòng ${n}`, roomStatus: RoomStatus.AVAILABLE, branchId: P + 'branch-1' } },
      { upsert: true },
    );
  }

  const now = Date.now();
  const poster = (n: number) => `https://picsum.photos/seed/uc09-${n}/300/450`;

  // [key, tên, thời lượng, thể loại, trạng thái, ngày công chiếu (offset ngày), isActive]
  const movies: [string, string, number, string[], MovieStatus, number, boolean][] = [
    ['m01', 'Chiến Binh Bóng Đêm', 128, ['action'], MovieStatus.NOW_SHOWING, -10, true], // có suất chiếu tương lai -> MSG07
    ['m02', 'Cười Lên Nào', 95, ['comedy'], MovieStatus.NOW_SHOWING, -20, true], // chỉ có suất chiếu đã kết thúc -> vô hiệu hoá được
    ['m03', 'Ngôi Nhà Ma Ám', 105, ['horror'], MovieStatus.NOW_SHOWING, -5, true], // không có suất chiếu -> vô hiệu hoá được
    ['m04', 'Mùa Yêu Dấu', 112, ['romance'], MovieStatus.COMING_SOON, 15, true],
    ['m05', 'Vương Quốc Phiêu Lưu', 98, ['animation', 'comedy'], MovieStatus.COMING_SOON, 30, true],
    ['m06', 'Truy Đuổi Tốc Độ', 120, ['action'], MovieStatus.ENDED, -90, true],
    ['m07', 'Hài Đến Cùng', 90, ['comedy'], MovieStatus.ENDED, -120, false], // đã vô hiệu hoá
    ['m08', 'Bóng Ma Học Đường', 101, ['horror'], MovieStatus.COMING_SOON, 7, true],
    ['m09', 'Hẹn Em Ngày Nắng', 108, ['romance', 'comedy'], MovieStatus.NOW_SHOWING, -3, true],
    ['m10', 'Siêu Anh Hùng Nhí', 92, ['animation', 'action'], MovieStatus.NOW_SHOWING, -1, true],
    ['m11', 'Đêm Kinh Hoàng', 115, ['horror', 'action'], MovieStatus.ENDED, -60, false],
    ['m12', 'Tình Yêu Hoạt Hình', 88, ['animation', 'romance'], MovieStatus.COMING_SOON, 45, true],
  ];
  let i = 0;
  for (const [k, name, duration, gs, status, offset, isActive] of movies) {
    i++;
    await MovieM.updateOne(
      { movieId: P + k },
      {
        $set: {
          movieName: name,
          duration,
          status,
          description: `Mô tả mẫu cho phim "${name}".`,
          releaseDate: new Date(now + offset * DAY),
          posterUrl: poster(i),
          isActive,
          genreIds: gs.map((g) => P + g),
        },
      },
      { upsert: true },
    );
  }

  // Suất chiếu
  const showtimes: [string, string, string, number, number][] = [
    // [key, movie, room, startOffsetHours, durationMinutes]
    ['s1', 'm01', 'room-1', 3, 128], // tương lai
    ['s2', 'm01', 'room-2', 27, 128],
    ['s3', 'm02', 'room-1', -72, 95], // đã kết thúc
    ['s4', 'm09', 'room-2', 6, 108], // tương lai
    ['s5', 'm10', 'room-1', -30, 92], // đã kết thúc
  ];
  for (const [k, m, r, startH, dur] of showtimes) {
    const start = new Date(now + startH * HOUR);
    await ShowtimeM.updateOne(
      { showtimeId: P + k },
      {
        $set: {
          movieId: P + m,
          roomId: P + r,
          startTime: start,
          endTime: new Date(start.getTime() + dur * 60 * 1000),
          basePrice: 90000,
        },
      },
      { upsert: true },
    );
  }

  console.log(
    `Seed xong: ${genres.length} thể loại, 1 chi nhánh, 2 phòng, ${movies.length} phim, ${showtimes.length} suất chiếu.`,
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
