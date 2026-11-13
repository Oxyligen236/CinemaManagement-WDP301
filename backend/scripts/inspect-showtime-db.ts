import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, branchName: true, branchStatus: true },
  });
  const rooms = await prisma.room.findMany({
    select: { id: true, branchId: true, roomName: true, roomStatus: true },
  });
  const movies = await prisma.movie.findMany({
    select: { id: true, movieName: true, duration: true, status: true, isActive: true },
  });
  const showtimeCount = await prisma.showtime.count();
  const latest = await prisma.showtime.findFirst({
    orderBy: { startTime: 'desc' },
    select: { startTime: true, endTime: true, basePrice: true, roomId: true },
  });
  const seatCounts = await Promise.all(
    rooms.map(async (r) => ({
      roomId: r.id,
      seats: await prisma.seat.count({ where: { roomId: r.id, status: 'AVAILABLE' } }),
    })),
  );

  console.log('=== BRANCHES ===');
  for (const b of branches) {
    const roomsOfBranch = rooms.filter((r) => r.branchId === b.id);
    console.log(`${b.branchName} [${b.branchStatus}] id=${b.id} rooms=${roomsOfBranch.length}`);
    for (const r of roomsOfBranch) {
      const sc = seatCounts.find((s) => s.roomId === r.id)?.seats ?? 0;
      console.log(`  - ${r.roomName} [${r.roomStatus}] seats(AVAILABLE)=${sc} id=${r.id}`);
    }
  }
  console.log('\n=== MOVIES ===');
  for (const m of movies) {
    console.log(`${m.movieName} [${m.status}] active=${m.isActive} duration=${m.duration}m id=${m.id}`);
  }
  console.log(`\n=== SHOWTIMES === total=${showtimeCount}`);
  if (latest) console.log('latest:', JSON.stringify(latest));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
