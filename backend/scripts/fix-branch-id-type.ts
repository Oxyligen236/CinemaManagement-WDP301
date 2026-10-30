/**
 * Chuẩn hóa kiểu dữ liệu của `branches.branchId` về string.
 *
 * Bối cảnh: sau lần migrate sang ObjectId, một số document trong `branches` bị
 * ghi `branchId` dưới dạng BSON ObjectId, trong khi `branch.schema.ts` khai báo
 * `branchId: string`. Mongoose không cast string sang ObjectId khi so sánh field
 * kiểu String, nên mọi query `findOne({ branchId: '<hex>' })` đều trả về null —
 * làm hỏng luồng gán chi nhánh cho Branch Manager / Staff.
 *
 * Script này idempotent: chạy lại nhiều lần vẫn an toàn.
 */
import mongoose from 'mongoose';
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

  const branches = db.collection('branches');
  const legacy = await branches
    .find({ branchId: { $type: 'objectId' } })
    .toArray();

  if (legacy.length === 0) {
    console.log('Không có document nào cần sửa. branchId đã là string.');
  }

  for (const doc of legacy) {
    const hex = String(doc.branchId);
    await branches.updateOne({ _id: doc._id }, { $set: { branchId: hex } });
    console.log(`branches: ${String(doc.branchName)} → branchId = "${hex}"`);
  }

  // Document thiếu hẳn branchId thì lấy _id làm branchId cho đồng nhất.
  const missing = await branches
    .find({ branchId: { $exists: false } })
    .toArray();
  for (const doc of missing) {
    const hex = String(doc._id);
    await branches.updateOne({ _id: doc._id }, { $set: { branchId: hex } });
    console.log(
      `branches: ${String(doc.branchName)} → thêm branchId = "${hex}"`,
    );
  }

  const remaining = await branches.countDocuments({
    branchId: { $not: { $type: 'string' } },
  });
  console.log(
    `Hoàn tất. Số document còn sai kiểu: ${remaining} (kỳ vọng 0). Safe to run again.`,
  );

  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
