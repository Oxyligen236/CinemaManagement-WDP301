import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOTAL = 100;
const DAYS = 14;
const VN_OFFSET_MINUTES = 420; // UTC+7
const BASE_PRICE = 75000;
// Khung giờ VN, cách nhau 225 phút — đủ cho phim dài nhất 210 phút
const SLOTS: Array<{ hour: number; minute: number }> = [
  { hour: 9, minute: 0 },
  { hour: 12, minute: 45 },
  { hour: 16, minute: 30 },
  { hour: 20, minute: 15 },
];

const SEAT_PRICE_SELECTIONS = [
  { seatType: 'STANDARD', ruleId: null, multiplier: 1.0 },
  { seatType: 'VIP', ruleId: null, multiplier: 1.25 },
  { seatType: 'COUPLE', ruleId: null, multiplier: 1.8 },
];
const DAY_PRICE_SELECTIONS = [
  { dayType: 'WEEKDAY', ruleId: null, multiplier: 1.0 },
  { dayType: 'WEEKEND', ruleId: null, multiplier: 1.2 },
];

function vnDateToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - VN_OFFSET_MINUTES * 60_000);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const branches = await prisma.branch.findMany({
    where: { branchStatus: 'ACTIVE' },
    select: { id: true, branchName: true },
  });
  const rooms = await prisma.room.findMany({
    where: { roomStatus: 'AVAILABLE' },
    select: { id: true, branchId: true, roomName: true },
  });
  const movies = await prisma.movie.findMany({
    where: { status: 'NOW_SHOWING', isActive: true },
    select: { id: true, movieName: true, duration: true },
  });
  if (!branches.length || !rooms.length || !movies.length) {
    throw new Error('Thiếu dữ liệu branch/room/movie trong DB');
  }

  const perBranch = Math.floor(TOTAL / branches.length);
  const remainder = TOTAL % branches.length;

  // Ngày bắt đầu: ngày mai theo giờ VN
  const nowVn = new Date(Date.now() + VN_OFFSET_MINUTES * 60_000);
  const startYear = nowVn.getUTCFullYear();
  const startMonth = nowVn.getUTCMonth();
  const startDay = nowVn.getUTCDate() + 1;

  // Showtime hiện có trong & sau cửa sổ seed, group theo room để check overlap
  const windowStart = vnDateToUtc(startYear, startMonth, startDay, 0, 0);
  const existing = await prisma.showtime.findMany({
    where: { endTime: { gte: windowStart } },
    select: { roomId: true, startTime: true, endTime: true },
  });
  const busyByRoom = new Map<string, Array<{ start: number; end: number }>>();
  for (const s of existing) {
    const list = busyByRoom.get(s.roomId) ?? [];
    list.push({ start: s.startTime.getTime(), end: s.endTime.getTime() });
    busyByRoom.set(s.roomId, list);
  }

  let created = 0;
  const summary: Record<string, number> = {};

  for (let bi = 0; bi < branches.length; bi++) {
    const branch = branches[bi];
    const target = perBranch + (bi < remainder ? 1 : 0);
    const branchRooms = rooms.filter((r) => r.branchId === branch.id);
    if (!branchRooms.length) {
      console.warn(`Bỏ qua ${branch.branchName}: không có phòng AVAILABLE`);
      continue;
    }

    let made = 0;
    for (let ri = 0; ri < branchRooms.length && made < target; ri++) {
      const room = branchRooms[ri];
      const quota = Math.ceil((target - made) / (branchRooms.length - ri));
      const busy = busyByRoom.get(room.id) ?? [];
      busyByRoom.set(room.id, busy);

      // Tất cả cặp (ngày, khung giờ) trong 14 ngày, xáo trộn
      const candidates = shuffle(
        Array.from({ length: DAYS }, (_, d) => d).flatMap((d) =>
          SLOTS.map((slot) => ({ d, slot })),
        ),
      );

      let roomMade = 0;
      for (const c of candidates) {
        if (roomMade >= quota) break;
        const movie = movies[Math.floor(Math.random() * movies.length)];
        const startTime = vnDateToUtc(
          startYear, startMonth, startDay + c.d, c.slot.hour, c.slot.minute,
        );
        const endTime = new Date(startTime.getTime() + movie.duration * 60_000);
        const st = startTime.getTime();
        const et = endTime.getTime();
        if (busy.some((b) => b.start < et && b.end > st)) continue;

        const showtime = await prisma.showtime.create({
          data: {
            movieId: movie.id,
            roomId: room.id,
            startTime,
            endTime,
            basePrice: BASE_PRICE,
            seatPriceSelections: SEAT_PRICE_SELECTIONS,
            dayPriceSelections: DAY_PRICE_SELECTIONS,
          },
        });
        const seats = await prisma.seat.findMany({
          where: { roomId: room.id, status: 'AVAILABLE' },
          select: { id: true },
        });
        await prisma.seatShowtime.createMany({
          data: seats.map((s) => ({
            showtimeId: showtime.id,
            seatId: s.id,
            seatStatus: 'EMPTY' as const,
          })),
        });

        busy.push({ start: st, end: et });
        roomMade++;
        made++;
        created++;
      }
      if (roomMade < quota) {
        console.warn(`${branch.branchName} / ${room.roomName}: chỉ tạo được ${roomMade}/${quota} (hết slot trống)`);
      }
    }
    summary[branch.branchName] = made;
  }

  console.log('\n=== KẾT QUẢ ===');
  for (const [name, n] of Object.entries(summary)) console.log(`${name}: ${n}`);
  console.log(`Tổng: ${created}/${TOTAL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
