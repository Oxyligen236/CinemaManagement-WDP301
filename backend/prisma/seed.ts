import {
  PrismaClient,
  Role,
  BranchStatus,
  RoomStatus,
  SeatType,
  SeatStatus,
  MovieStatus,
  SeatShowtimeStatus,
  ItemCategory,
  ItemSize,
  ItemStatus,
  OrderStatus,
  TicketStatus,
  PaymentMethod,
  PaymentStatus,
  DiscountType,
  DayType,
  ShiftAttendanceStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING COMPLETE FRESH SEEDING ===');
  const defaultPasswordHash = await bcrypt.hash('12345678', 10);

  // 1. CLEAR COLLECTIONS IN REVERSE DEPENDENCY ORDER
  console.log('[1/12] Clearing existing collections...');
  await prisma.shiftAttendance.deleteMany({});
  await prisma.shiftAssignment.deleteMany({});
  await prisma.workSchedule.deleteMany({});
  await prisma.promotionUsage.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.productOrder.deleteMany({});
  await prisma.seatOrder.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.seatShowtime.deleteMany({});
  await prisma.showtime.deleteMany({});
  await prisma.seat.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.combo.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.promotion.deleteMany({});
  await prisma.movie.deleteMany({});
  await prisma.genre.deleteMany({});
  await prisma.dayPriceRule.deleteMany({});
  await prisma.seatPriceRule.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});
  console.log('Cleared all collections successfully.');

  // 2. SEED BRANCHES
  console.log('[2/12] Seeding branches...');
  const branchesData = [
    {
      branchName: 'Latte Cinema Cantavil',
      address: 'Tầng 7, Cantavil Premier, An Phú, TP. Thủ Đức, TP.HCM',
      hotline: '028 3740 6180',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchName: 'Latte Cinema Landmark',
      address:
        'Tầng B1, Vincom Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM',
      hotline: '028 3821 7890',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchName: 'Latte Cinema Nam Sài Gòn',
      address:
        'Tầng 3, Lotte Mart Nam Sài Gòn, 469 Nguyễn Hữu Thọ, Quận 7, TP.HCM',
      hotline: '028 3775 2524',
      branchStatus: BranchStatus.ACTIVE,
    },
    {
      branchName: 'Latte Cinema Tây Hồ',
      address: 'Tầng 4, Lotte Mall West Lake, 272 Võ Chí Công, Tây Hồ, Hà Nội',
      hotline: '024 3333 6000',
      branchStatus: BranchStatus.ACTIVE,
    },
  ];

  const branches = [];
  for (const b of branchesData) {
    const created = await prisma.branch.create({ data: b });
    branches.push(created);
  }
  console.log(`Seeded ${branches.length} branches.`);

  // 3. SEED USERS
  console.log('[3/12] Seeding users with password: "12345678"...');
  const usersData = [
    // Admins
    {
      email: 'admin@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Admin',
      lastName: 'System',
      role: Role.ADMIN,
      isActive: true,
    },
    {
      email: 'admin@mycast.vn',
      password: defaultPasswordHash,
      firstName: 'MyCast',
      lastName: 'Admin',
      role: Role.ADMIN,
      isActive: true,
    },
    // Branch Managers
    {
      email: 'manager.cantavil@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Quản Lý',
      lastName: 'Cantavil',
      role: Role.MANAGER,
      isActive: true,
      branchId: branches[0].id,
    },
    {
      email: 'manager.landmark@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Quản Lý',
      lastName: 'Landmark',
      role: Role.MANAGER,
      isActive: true,
      branchId: branches[1].id,
    },
    {
      email: 'manager.namsaigon@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Quản Lý',
      lastName: 'Nam Sài Gòn',
      role: Role.MANAGER,
      isActive: true,
      branchId: branches[2].id,
    },
    // Branch Staff
    {
      email: 'staff.cantavil@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Nhân Viên',
      lastName: 'Cantavil',
      role: Role.STAFF,
      isActive: true,
      branchId: branches[0].id,
    },
    {
      email: 'staff.landmark@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Nhân Viên',
      lastName: 'Landmark',
      role: Role.STAFF,
      isActive: true,
      branchId: branches[1].id,
    },
    {
      email: 'staff.namsaigon@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Nhân Viên',
      lastName: 'Nam Sài Gòn',
      role: Role.STAFF,
      isActive: true,
      branchId: branches[2].id,
    },
    // Customers (USER)
    {
      email: 'customer1@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Minh',
      lastName: 'Nguyễn',
      role: Role.USER,
      isActive: true,
    },
    {
      email: 'customer2@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Hương',
      lastName: 'Trần',
      role: Role.USER,
      isActive: true,
    },
    {
      email: 'customer3@cinema.local',
      password: defaultPasswordHash,
      firstName: 'Tuấn',
      lastName: 'Lê',
      role: Role.USER,
      isActive: true,
    },
    {
      email: 'customer@mycast.vn',
      password: defaultPasswordHash,
      firstName: 'Vũ',
      lastName: 'Phạm',
      role: Role.USER,
      isActive: true,
    },
  ];

  const users = [];
  for (const u of usersData) {
    const created = await prisma.user.create({ data: u });
    users.push(created);
  }
  console.log(`Seeded ${users.length} users with password '12345678'.`);

  // 4. SEED ROOMS & SEATS
  console.log('[4/12] Seeding rooms and seats...');
  const rooms = [];
  const allSeats = [];
  for (const branch of branches) {
    for (let r = 1; r <= 2; r++) {
      const room = await prisma.room.create({
        data: {
          roomName: `Phòng chiếu ${r} - ${branch.branchName.replace('Latte Cinema ', '')}`,
          branchId: branch.id,
          roomStatus: RoomStatus.AVAILABLE,
        },
      });
      rooms.push(room);

      // Create 5 rows x 6 columns = 30 seats per room
      const rowLabels = ['A', 'B', 'C', 'D', 'E'];
      for (let rowIndex = 0; rowIndex < rowLabels.length; rowIndex++) {
        const row = rowLabels[rowIndex];
        let seatType: SeatType = SeatType.STANDARD;
        if (row === 'C' || row === 'D') seatType = SeatType.VIP;
        if (row === 'E') seatType = SeatType.COUPLE;

        for (let col = 1; col <= 6; col++) {
          const seat = await prisma.seat.create({
            data: {
              roomId: room.id,
              rowPosition: row,
              columnPosition: col,
              seatType,
              status: SeatStatus.AVAILABLE,
            },
          });
          allSeats.push(seat);
        }
      }
    }
  }
  console.log(`Seeded ${rooms.length} rooms and ${allSeats.length} seats.`);

  // 5. SEED GENRES & MOVIES
  console.log('[5/12] Seeding genres and movies...');
  const genreNames = [
    'Hành Động',
    'Khoa Học Viễn Tưởng',
    'Kinh Dị',
    'Hoạt Hình',
    'Tình Cảm',
    'Hài Hước',
  ];
  const genres = [];
  for (const g of genreNames) {
    const genre = await prisma.genre.create({
      data: {
        genreName: g,
        genreDescription: `Thể loại phim ${g}`,
      },
    });
    genres.push(genre);
  }

  const moviesData = [
    {
      movieName: 'Dune: Hành Tinh Cát - Phần 2',
      duration: 166,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Paul Atreides liên minh với Chani và người Fremen trên con đường báo thù.',
      posterKey: 'posters/dune2.jpg',
      trailerUrl: 'https://youtube.com/watch?v=Way9Dexny3w',
      releaseDate: new Date('2026-03-01'),
      genreIds: [genres[0].id, genres[1].id],
    },
    {
      movieName: 'Kung Fu Panda 4',
      duration: 94,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Po chuẩn bị trở thành Thủ lĩnh Tinh thần của Thung lũng Bình Yên.',
      posterKey: 'posters/kungfupanda4.jpg',
      trailerUrl: 'https://youtube.com/watch?v=_inKs4eeHiI',
      releaseDate: new Date('2026-03-08'),
      genreIds: [genres[0].id, genres[3].id, genres[5].id],
    },
    {
      movieName: 'Godzilla x Kong: Đế Chế Mới',
      duration: 115,
      status: MovieStatus.NOW_SHOWING,
      description:
        'Một mối đe dọa khổng lồ chưa từng thấy xuất hiện từ lòng Trái Đất.',
      posterKey: 'posters/godzillaxkong.jpg',
      trailerUrl: 'https://youtube.com/watch?v=lV1OOlGwExg',
      releaseDate: new Date('2026-03-29'),
      genreIds: [genres[0].id, genres[1].id],
    },
    {
      movieName: 'Deadpool & Wolverine',
      duration: 127,
      status: MovieStatus.COMING_SOON,
      description: 'Wade Wilson và Logan hợp lực cứu vũ trụ Marvel.',
      posterKey: 'posters/deadpool-wolverine.jpg',
      trailerUrl: 'https://youtube.com/watch?v=73_1biulkYk',
      releaseDate: new Date('2026-11-15'),
      genreIds: [genres[0].id, genres[5].id],
    },
    {
      movieName: 'Mai',
      duration: 131,
      status: MovieStatus.ENDED,
      description: 'Bộ phim tình cảm tâm lý gia đình của đạo diễn Trấn Thành.',
      posterKey: 'posters/mai.jpg',
      releaseDate: new Date('2026-02-10'),
      genreIds: [genres[4].id],
    },
  ];

  const movies = [];
  for (const m of moviesData) {
    const created = await prisma.movie.create({ data: m });
    movies.push(created);
  }
  console.log(`Seeded ${genres.length} genres and ${movies.length} movies.`);

  // 6. SEED PRICE RULES
  console.log('[6/12] Seeding price rules...');
  await prisma.seatPriceRule.createMany({
    data: [
      { seatType: SeatType.STANDARD, adjustmentValue: 0 },
      { seatType: SeatType.VIP, adjustmentValue: 20000 },
      { seatType: SeatType.COUPLE, adjustmentValue: 40000 },
    ],
  });

  await prisma.dayPriceRule.createMany({
    data: [
      { dayType: DayType.WEEKDAY, adjustmentValue: 0 },
      { dayType: DayType.WEEKEND, adjustmentValue: 15000 },
      { dayType: DayType.HOLIDAY, adjustmentValue: 25000 },
    ],
  });

  // 7. SEED SHOWTIMES & SEAT SHOWTIMES
  console.log('[7/12] Seeding showtimes & seat showtimes...');
  const showtimes = [];
  const basePrice = 85000;
  const now = new Date();

  // Create showtimes across rooms for active movies
  const activeMovies = movies.filter(
    (m) => m.status === MovieStatus.NOW_SHOWING,
  );
  for (const room of rooms) {
    for (let s = 0; s < 2; s++) {
      const movie =
        activeMovies[(s + rooms.indexOf(room)) % activeMovies.length];
      const startTime = new Date(now.getTime() + (s * 4 + 1) * 3600000);
      const endTime = new Date(startTime.getTime() + movie.duration * 60000);

      const showtime = await prisma.showtime.create({
        data: {
          movieId: movie.id,
          roomId: room.id,
          startTime,
          endTime,
          basePrice,
          seatPriceSelections: [
            { seatType: 'STANDARD', multiplier: 1.0 },
            { seatType: 'VIP', multiplier: 1.25 },
            { seatType: 'COUPLE', multiplier: 1.8 },
          ],
          dayPriceSelections: [
            { dayType: 'WEEKDAY', multiplier: 1.0 },
            { dayType: 'WEEKEND', multiplier: 1.2 },
          ],
        },
      });
      showtimes.push(showtime);

      // Create seat_showtimes for this room & showtime
      const roomSeats = allSeats.filter((st) => st.roomId === room.id);
      const seatShowtimesData = roomSeats.map((st) => ({
        showtimeId: showtime.id,
        seatId: st.id,
        seatStatus: SeatShowtimeStatus.EMPTY,
      }));
      await prisma.seatShowtime.createMany({ data: seatShowtimesData });
    }
  }
  const totalSeatShowtimes = await prisma.seatShowtime.count();
  console.log(
    `Seeded ${showtimes.length} showtimes and ${totalSeatShowtimes} seat_showtimes.`,
  );

  // 8. SEED CONCESSIONS (ITEMS, COMBOS, PRODUCTS)
  console.log('[8/12] Seeding concession items, combos, products...');
  for (const branch of branches) {
    // Items
    const popcorn = await prisma.item.create({
      data: {
        name: 'Bắp Rang Bơ (L)',
        category: ItemCategory.POPCORN,
        size: ItemSize.LARGE,
        price: 65000,
        status: ItemStatus.AVAILABLE,
        branchId: branch.id,
      },
    });
    const coke = await prisma.item.create({
      data: {
        name: 'Coca Cola (L)',
        category: ItemCategory.BEVERAGE,
        size: ItemSize.LARGE,
        price: 35000,
        status: ItemStatus.AVAILABLE,
        branchId: branch.id,
      },
    });

    // Combo
    await prisma.combo.create({
      data: {
        name: 'Combo Solo Phổ Thông',
        price: 85000,
        status: ItemStatus.AVAILABLE,
        branchId: branch.id,
        items: [
          { itemId: popcorn.id, quantity: 1 },
          { itemId: coke.id, quantity: 1 },
        ],
      },
    });

    // Product
    await prisma.product.create({
      data: {
        productName: 'Combo Sweet Couple',
        price: 110000,
        status: 'AVAILABLE',
        branchId: branch.id,
      },
    });
  }

  // 9. SEED PROMOTIONS
  console.log('[9/12] Seeding promotions...');
  const promo = await prisma.promotion.create({
    data: {
      promotionCode: 'LATTEWELCOME',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 15,
      minOrderValue: 100000,
      maxDiscountAmount: 50000,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 1000,
      usedCount: 1,
      isActive: true,
      title: 'Khuyến mãi thành viên mới',
      description: 'Giảm 15% cho đơn hàng đầu tiên',
    },
  });

  // 10. SEED SAMPLE ORDERS, TICKETS, PAYMENTS
  console.log('[10/12] Seeding sample orders, tickets, payments...');
  const sampleCustomer = users.find(
    (u) => u.email === 'customer1@cinema.local',
  )!;
  const sampleShowtime = showtimes[0];
  const sampleSeatShowtimes = await prisma.seatShowtime.findMany({
    where: { showtimeId: sampleShowtime.id },
    take: 2,
    include: { seat: true },
  });

  // Mark seat showtimes as booked
  for (const ss of sampleSeatShowtimes) {
    await prisma.seatShowtime.update({
      where: { id: ss.id },
      data: { seatStatus: SeatShowtimeStatus.BOOKED },
    });
  }

  const sampleOrder = await prisma.order.create({
    data: {
      userId: sampleCustomer.id,
      branchId: branches[0].id,
      promotionId: promo.id,
      totalAmount: 170000,
      status: OrderStatus.PAID,
    },
  });

  // Seat Orders & Tickets
  for (const ss of sampleSeatShowtimes) {
    await prisma.seatOrder.create({
      data: {
        orderId: sampleOrder.id,
        seatShowtimeId: ss.id,
        price: 85000,
      },
    });

    await prisma.ticket.create({
      data: {
        orderId: sampleOrder.id,
        seatShowtimeId: ss.id,
        ticketCode: `TK-${Date.now()}-${ss.seat.rowPosition}${ss.seat.columnPosition}`,
        price: 85000,
        ticketStatus: TicketStatus.VALID,
      },
    });
  }

  // Payment
  await prisma.payment.create({
    data: {
      orderId: sampleOrder.id,
      amount: 170000,
      method: PaymentMethod.VNPAY,
      status: PaymentStatus.SUCCESS,
      transactionId: `VNP-${Date.now()}`,
    },
  });

  // Promotion usage
  await prisma.promotionUsage.create({
    data: {
      promotionId: promo.id,
      userId: sampleCustomer.id,
      orderId: sampleOrder.id,
      usedAt: new Date(),
    },
  });

  // 11. SEED WORK SCHEDULES, SHIFT ASSIGNMENTS & ATTENDANCE
  console.log('[11/12] Seeding work schedules and shifts...');
  const staffCantavil = users.find(
    (u) => u.email === 'staff.cantavil@cinema.local',
  )!;
  const workSchedule = await prisma.workSchedule.create({
    data: {
      shiftName: 'Ca Sáng (08:00 - 16:00)',
      startTime: '08:00',
      endTime: '16:00',
      durationInMinutes: 480,
      isOvernight: false,
      userIds: [staffCantavil.id],
      branchId: branches[0].id,
      note: 'Ca làm việc phục vụ vé và phòng chiếu',
      isActive: true,
    },
  });

  const shiftDateStr = new Date().toISOString().split('T')[0];

  await prisma.shiftAssignment.create({
    data: {
      scheduleId: workSchedule.id,
      userId: staffCantavil.id,
      date: shiftDateStr,
      branchId: branches[0].id,
    },
  });

  await prisma.shiftAttendance.create({
    data: {
      scheduleId: workSchedule.id,
      userId: staffCantavil.id,
      date: shiftDateStr,
      branchId: branches[0].id,
      checkInAt: new Date(),
      status: ShiftAttendanceStatus.COMPLETED,
    },
  });

  // 12. SUMMARY COUNT
  console.log('[12/12] Verifying seeded document counts across all models:');
  const counts = {
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    rooms: await prisma.room.count(),
    seats: await prisma.seat.count(),
    genres: await prisma.genre.count(),
    movies: await prisma.movie.count(),
    seatPriceRules: await prisma.seatPriceRule.count(),
    dayPriceRules: await prisma.dayPriceRule.count(),
    showtimes: await prisma.showtime.count(),
    seatShowtimes: await prisma.seatShowtime.count(),
    items: await prisma.item.count(),
    combos: await prisma.combo.count(),
    products: await prisma.product.count(),
    promotions: await prisma.promotion.count(),
    orders: await prisma.order.count(),
    seatOrders: await prisma.seatOrder.count(),
    tickets: await prisma.ticket.count(),
    payments: await prisma.payment.count(),
    promotionUsages: await prisma.promotionUsage.count(),
    workSchedules: await prisma.workSchedule.count(),
    shiftAssignments: await prisma.shiftAssignment.count(),
    shiftAttendances: await prisma.shiftAttendance.count(),
  };

  console.table(counts);
  console.log('=== COMPLETE FRESH SEEDING FINISHED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
