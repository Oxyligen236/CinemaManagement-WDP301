import mongoose, { ObjectId } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

function mongoUri() {
  const env = path.resolve(__dirname, '../.env');
  const value =
    fs.existsSync(env) &&
    fs
      .readFileSync(env, 'utf8')
      .match(/^MONGODB_URI=(.*)$/m)?.[1]
      ?.trim();
  return value || process.env.MONGODB_URI || 'mongodb://localhost:27017/wdp';
}

async function main() {
  await mongoose.connect(mongoUri());
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  const branches = await db
    .collection('branches')
    .find({}, { projection: { branchId: 1 } })
    .toArray();
  const ids = new Map(
    branches
      .filter((b) => b.branchId)
      .map((b) => [b.branchId as string, b._id.toString()]),
  );
  const collections = [
    'users',
    'rooms',
    'products',
    'items',
    'combos',
    'orders',
    'work_schedules',
    'shift_assignments',
    'shift_attendances',
  ];
  for (const name of collections) {
    const collection = db.collection(name);
    for (const [legacy, id] of ids) {
      const result = await collection.updateMany(
        { branchId: legacy },
        { $set: { branchId: id } },
      );
      if (result.modifiedCount)
        console.log(`${name}: ${legacy} → ${id} (${result.modifiedCount})`);
    }
  }
  console.log('Branch ObjectId migration completed. Safe to run again.');
  await mongoose.disconnect();
}
void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
