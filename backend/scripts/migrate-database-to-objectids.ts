import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

function getMongoUri(): string {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^DATABASE_URL=(.*)$/m) || content.match(/^MONGODB_URI=(.*)$/m);
    if (match?.[1]) return match[1].trim();
  }
  return process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/wdp_project';
}

async function migrate() {
  const uri = getMongoUri();
  console.log('Connecting to MongoDB:', uri.replace(/:[^:]*@/, ':****@'));
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection failed');
  const database = db;

  console.log('=== Step 1: Building ID Mapping Tables ===');

  async function getMapping(collectionName: string, idField: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const docs = await database.collection(collectionName).find({}).project({ _id: 1, [idField]: 1 }).toArray();
    for (const doc of docs) {
      const objIdStr = doc._id.toString();
      const legacyId = doc[idField];
      if (legacyId && typeof legacyId === 'string') {
        map.set(legacyId, objIdStr);
      }
      map.set(objIdStr, objIdStr);
    }
    console.log(`[${collectionName}] Mapped ${docs.length} records (${map.size} keys)`);
    return map;
  }

  const userMap = await getMapping('users', 'userId');
  const branchMap = await getMapping('branches', 'branchId');
  const roomMap = await getMapping('rooms', 'roomId');
  const seatMap = await getMapping('seats', 'seatId');
  const genreMap = await getMapping('genres', 'genreId');
  const movieMap = await getMapping('movies', 'movieId');
  const showtimeMap = await getMapping('showtimes', 'showtimeId');
  const seatShowtimeMap = await getMapping('seat_showtimes', 'seatShowtimeId');
  const itemMap = await getMapping('items', 'itemId');
  const comboMap = await getMapping('combos', 'comboId');
  const orderMap = await getMapping('orders', 'orderId');
  const promotionMap = await getMapping('promotions', 'promotionId');
  const scheduleMap = await getMapping('work_schedules', 'scheduleId');

  console.log('\n=== Step 2: Updating Foreign References ===');

  // 1. users.branchId
  const users = await database.collection('users').find({ branchId: { $exists: true, $ne: null } }).toArray();
  for (const u of users) {
    const mapped = branchMap.get(u.branchId);
    if (mapped && mapped !== u.branchId) {
      await database.collection('users').updateOne({ _id: u._id }, { $set: { branchId: mapped } });
    }
  }

  // 2. rooms.branchId
  const rooms = await database.collection('rooms').find({ branchId: { $exists: true, $ne: null } }).toArray();
  for (const r of rooms) {
    const mapped = branchMap.get(r.branchId);
    if (mapped && mapped !== r.branchId) {
      await database.collection('rooms').updateOne({ _id: r._id }, { $set: { branchId: mapped } });
    }
  }

  // 3. seats.roomId
  const seats = await database.collection('seats').find({ roomId: { $exists: true, $ne: null } }).toArray();
  for (const s of seats) {
    const mapped = roomMap.get(s.roomId);
    if (mapped && mapped !== s.roomId) {
      await database.collection('seats').updateOne({ _id: s._id }, { $set: { roomId: mapped } });
    }
  }

  // 4. movies.genreIds
  const movies = await database.collection('movies').find({ genreIds: { $exists: true, $ne: null } }).toArray();
  for (const m of movies) {
    if (Array.isArray(m.genreIds)) {
      const updatedGenreIds = m.genreIds.map((g: string) => genreMap.get(g) || g);
      await database.collection('movies').updateOne({ _id: m._id }, { $set: { genreIds: updatedGenreIds } });
    }
  }

  // 5. showtimes.movieId & showtimes.roomId
  const showtimes = await database.collection('showtimes').find({}).toArray();
  const stOps: any[] = [];
  for (const st of showtimes) {
    const update: Record<string, any> = {};
    if (st.movieId && movieMap.has(st.movieId)) update.movieId = movieMap.get(st.movieId);
    if (st.roomId && roomMap.has(st.roomId)) update.roomId = roomMap.get(st.roomId);
    if (Object.keys(update).length > 0) {
      stOps.push({
        updateOne: {
          filter: { _id: st._id },
          update: { $set: update },
        },
      });
    }
  }
  if (stOps.length > 0) {
    await database.collection('showtimes').bulkWrite(stOps, { ordered: false });
    console.log(`[showtimes] Updated ${stOps.length} foreign references`);
  }

  // 6. seat_showtimes.showtimeId & seat_showtimes.seatId
  console.log('[seat_showtimes] Processing batch updates...');
  const ssCursor = database.collection('seat_showtimes').find({});
  let ssBatch: any[] = [];
  let totalSS = 0;
  while (await ssCursor.hasNext()) {
    const ss = await ssCursor.next();
    if (!ss) continue;
    const update: Record<string, any> = {};
    if (ss.showtimeId && showtimeMap.has(ss.showtimeId)) update.showtimeId = showtimeMap.get(ss.showtimeId);
    if (ss.seatId && seatMap.has(ss.seatId)) update.seatId = seatMap.get(ss.seatId);
    if (Object.keys(update).length > 0) {
      ssBatch.push({
        updateOne: {
          filter: { _id: ss._id },
          update: { $set: update },
        },
      });
    }
    if (ssBatch.length >= 1000) {
      await database.collection('seat_showtimes').bulkWrite(ssBatch, { ordered: false });
      totalSS += ssBatch.length;
      ssBatch = [];
      console.log(`[seat_showtimes] Updated ${totalSS} references so far`);
    }
  }
  if (ssBatch.length > 0) {
    await database.collection('seat_showtimes').bulkWrite(ssBatch, { ordered: false });
    totalSS += ssBatch.length;
    console.log(`[seat_showtimes] Updated ${totalSS} references total`);
  }

  // 7. items.branchId
  const items = await database.collection('items').find({ branchId: { $exists: true, $ne: null } }).toArray();
  for (const it of items) {
    const mapped = branchMap.get(it.branchId);
    if (mapped && mapped !== it.branchId) {
      await database.collection('items').updateOne({ _id: it._id }, { $set: { branchId: mapped } });
    }
  }

  // 8. combos.branchId & combos.items.itemId
  const combos = await database.collection('combos').find({}).toArray();
  for (const cb of combos) {
    const update: Record<string, any> = {};
    if (cb.branchId && branchMap.has(cb.branchId)) update.branchId = branchMap.get(cb.branchId);
    if (Array.isArray(cb.items)) {
      update.items = cb.items.map((ci: any) => ({
        ...ci,
        itemId: itemMap.get(ci.itemId) || ci.itemId,
      }));
    }
    if (Object.keys(update).length > 0) {
      await database.collection('combos').updateOne({ _id: cb._id }, { $set: update });
    }
  }

  // 9. orders
  const orders = await database.collection('orders').find({}).toArray();
  for (const ord of orders) {
    const update: Record<string, any> = {};
    if (ord.userId && userMap.has(ord.userId)) update.userId = userMap.get(ord.userId);
    if (ord.branchId && branchMap.has(ord.branchId)) update.branchId = branchMap.get(ord.branchId);
    if (ord.promotionId && promotionMap.has(ord.promotionId)) update.promotionId = promotionMap.get(ord.promotionId);
    if (Object.keys(update).length > 0) {
      await database.collection('orders').updateOne({ _id: ord._id }, { $set: update });
    }
  }

  // 10. seat_orders
  const seatOrders = await database.collection('seat_orders').find({}).toArray();
  for (const so of seatOrders) {
    const update: Record<string, any> = {};
    if (so.orderId && orderMap.has(so.orderId)) update.orderId = orderMap.get(so.orderId);
    if (so.seatShowtimeId && seatShowtimeMap.has(so.seatShowtimeId)) update.seatShowtimeId = seatShowtimeMap.get(so.seatShowtimeId);
    if (Object.keys(update).length > 0) {
      await database.collection('seat_orders').updateOne({ _id: so._id }, { $set: update });
    }
  }

  // 11. product_orders
  const productOrders = await database.collection('product_orders').find({}).toArray();
  for (const po of productOrders) {
    const update: Record<string, any> = {};
    if (po.orderId && orderMap.has(po.orderId)) update.orderId = orderMap.get(po.orderId);
    if (po.productId) {
      const mappedProduct = itemMap.get(po.productId) || comboMap.get(po.productId);
      if (mappedProduct) update.productId = mappedProduct;
    }
    if (Object.keys(update).length > 0) {
      await database.collection('product_orders').updateOne({ _id: po._id }, { $set: update });
    }
  }

  // 12. tickets
  const tickets = await database.collection('tickets').find({}).toArray();
  for (const tk of tickets) {
    const update: Record<string, any> = {};
    if (tk.orderId && orderMap.has(tk.orderId)) update.orderId = orderMap.get(tk.orderId);
    if (tk.seatShowtimeId && seatShowtimeMap.has(tk.seatShowtimeId)) update.seatShowtimeId = seatShowtimeMap.get(tk.seatShowtimeId);
    if (Object.keys(update).length > 0) {
      await database.collection('tickets').updateOne({ _id: tk._id }, { $set: update });
    }
  }

  // 13. payments
  const payments = await database.collection('payments').find({}).toArray();
  for (const pm of payments) {
    const update: Record<string, any> = {};
    if (pm.orderId && orderMap.has(pm.orderId)) update.orderId = orderMap.get(pm.orderId);
    if (Object.keys(update).length > 0) {
      await database.collection('payments').updateOne({ _id: pm._id }, { $set: update });
    }
  }

  // 14. work_schedules
  const schedules = await database.collection('work_schedules').find({}).toArray();
  for (const ws of schedules) {
    const update: Record<string, any> = {};
    if (ws.branchId && branchMap.has(ws.branchId)) update.branchId = branchMap.get(ws.branchId);
    if (Array.isArray(ws.userIds)) {
      update.userIds = ws.userIds.map((uid: string) => userMap.get(uid) || uid);
    }
    if (Object.keys(update).length > 0) {
      await database.collection('work_schedules').updateOne({ _id: ws._id }, { $set: update });
    }
  }

  // 15. shift_assignments
  const assignments = await database.collection('shift_assignments').find({}).toArray();
  for (const sa of assignments) {
    const update: Record<string, any> = {};
    if (sa.scheduleId && scheduleMap.has(sa.scheduleId)) update.scheduleId = scheduleMap.get(sa.scheduleId);
    if (sa.userId && userMap.has(sa.userId)) update.userId = userMap.get(sa.userId);
    if (sa.branchId && branchMap.has(sa.branchId)) update.branchId = branchMap.get(sa.branchId);
    if (Object.keys(update).length > 0) {
      await database.collection('shift_assignments').updateOne({ _id: sa._id }, { $set: update });
    }
  }

  // 16. shift_attendances
  const attendances = await database.collection('shift_attendances').find({}).toArray();
  for (const sat of attendances) {
    const update: Record<string, any> = {};
    if (sat.scheduleId && scheduleMap.has(sat.scheduleId)) update.scheduleId = scheduleMap.get(sat.scheduleId);
    if (sat.userId && userMap.has(sat.userId)) update.userId = userMap.get(sat.userId);
    if (sat.branchId && branchMap.has(sat.branchId)) update.branchId = branchMap.get(sat.branchId);
    if (Object.keys(update).length > 0) {
      await database.collection('shift_attendances').updateOne({ _id: sat._id }, { $set: update });
    }
  }

  console.log('\n=== Step 3: Dropping Obsolete Unique Indexes and Unsetting Redundant Own-IDs and __v ===');

  const unsets: Array<{ col: string; field: string }> = [
    { col: 'users', field: 'userId' },
    { col: 'branches', field: 'branchId' },
    { col: 'rooms', field: 'roomId' },
    { col: 'seats', field: 'seatId' },
    { col: 'genres', field: 'genreId' },
    { col: 'movies', field: 'movieId' },
    { col: 'showtimes', field: 'showtimeId' },
    { col: 'seat_showtimes', field: 'seatShowtimeId' },
    { col: 'items', field: 'itemId' },
    { col: 'combos', field: 'comboId' },
    { col: 'products', field: 'productId' },
    { col: 'orders', field: 'orderId' },
    { col: 'seat_orders', field: 'seatOrderId' },
    { col: 'product_orders', field: 'productOrderId' },
    { col: 'tickets', field: 'ticketId' },
    { col: 'payments', field: 'paymentId' },
    { col: 'promotions', field: 'promotionId' },
    { col: 'promotion_usages', field: 'usageId' },
    { col: 'work_schedules', field: 'scheduleId' },
    { col: 'shift_assignments', field: 'assignmentId' },
    { col: 'shift_attendances', field: 'attendanceId' },
    { col: 'seat_price_rules', field: 'ruleId' },
    { col: 'day_price_rules', field: 'ruleId' },
  ];

  for (const { col, field } of unsets) {
    try {
      const indexes = await database.collection(col).indexes();
      for (const idx of indexes) {
        if (idx.key && idx.key[field] && idx.name && idx.name !== '_id_') {
          await database.collection(col).dropIndex(idx.name);
          console.log(`[${col}] Dropped obsolete index ${idx.name}`);
        }
      }
    } catch (e: any) {
      console.warn(`[${col}] Index check: ${e.message}`);
    }

    const res = await database.collection(col).updateMany(
      { [field]: { $exists: true } },
      { $unset: { [field]: '', __v: '' } }
    );
    if (res.modifiedCount > 0) {
      console.log(`[${col}] Unset redundant field '${field}' on ${res.modifiedCount} docs`);
    }
  }

  console.log('\nDatabase migration completed successfully!');
  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
