/**
 * Seed + migrate dữ liệu cho UC-05 Revision 2 (Cấu hình danh sách hệ số nhân giá vé).
 * - Idempotent: upsert theo { seatType|dayType, adjustmentValue }, chạy lại không tạo trùng.
 * - Bản ghi seed có ruleId bắt đầu bằng `seed-uc05-`; dọn bằng: `ts-node scripts/seed-uc05.ts --clean`
 *   (chỉ xóa bản ghi có ruleId/userId tiền tố seed).
 * - Không đổi schema/index nên không gọi syncIndexes().
 * - Seed minh họa (chỉ khi trường chưa có giá trị nào): VIP 1.5 & 1.7; COUPLE 1.2; WEEKEND 1.2; HOLIDAY 1.5.
 * - Migrate singleton Revision 1 (collection `price_multiplier_configs`, configKey GLOBAL do người dùng thật tạo):
 *   chuyển VIP/WEEKEND/HOLIDAY thành giá trị nếu trường chưa có giá trị. Script KHÔNG xóa collection cũ.
 * - Document legacy `adjustmentValue < 1`: chỉ cảnh báo, không xóa/sửa.
 * - Tài khoản kiểm thử (mật khẩu: Password123!): admin-uc05@cinema.local (ADMIN), manager-uc05@cinema.local (MANAGER)
 *
 * Chạy: npx ts-node scripts/seed-uc05.ts
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { MULTIPLIER_MIN } from '../src/modules/pricerule/domain/constants/price-rule.constants';
import { DayType } from '../src/modules/pricerule/domain/enums/day-type.enum';
import { SeatType } from '../src/modules/pricerule/domain/enums/seat-type.enum';
import {
  DayPriceRule,
  DayPriceRuleSchema,
} from '../src/modules/pricerule/domain/schemas/day-price-rule.schema';
import {
  SeatPriceRule,
  SeatPriceRuleSchema,
} from '../src/modules/pricerule/domain/schemas/seat-price-rule.schema';
import { Role } from '../src/modules/user/domain/enums/role.enum';
import {
  User,
  UserSchema,
} from '../src/modules/user/domain/schemas/user.schema';

const P = 'seed-uc05-';
const PASSWORD = 'Password123!';
const LEGACY_CONFIG_COLLECTION = 'price_multiplier_configs';

/** Phần chung của SeatPriceRule/DayPriceRule model mà seed cần dùng. */
interface RuleModel {
  exists(filter: Record<string, unknown>): PromiseLike<unknown>;
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { upsert: boolean },
  ): PromiseLike<unknown>;
}

interface FieldSeed {
  model: RuleModel;
  keyName: 'seatType' | 'dayType';
  fieldKey: string;
  values: number[];
  legacyProp?: string;
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
  const SeatM = mongoose.model(SeatPriceRule.name, SeatPriceRuleSchema);
  const DayM = mongoose.model(DayPriceRule.name, DayPriceRuleSchema);
  const UserM = mongoose.model(User.name, UserSchema);

  const rx = new RegExp(`^${P}`);

  if (process.argv.includes('--clean')) {
    const r = await Promise.all([
      SeatM.deleteMany({ ruleId: rx }),
      DayM.deleteMany({ ruleId: rx }),
      UserM.deleteMany({ userId: rx }),
    ]);
    console.log(
      'Đã xoá (seat rules, day rules, users):',
      r.map((x) => x.deletedCount),
    );
    await mongoose.disconnect();
    return;
  }

  // 2. Cảnh báo document legacy (adjustmentValue < 1), không xóa/sửa
  const legacy = await Promise.all([
    SeatM.countDocuments({ adjustmentValue: { $lt: MULTIPLIER_MIN } }),
    DayM.countDocuments({ adjustmentValue: { $lt: MULTIPLIER_MIN } }),
  ]);
  if (legacy[0] + legacy[1] > 0) {
    console.warn(
      `Cảnh báo: có ${legacy[0]} seat rule và ${legacy[1]} day rule với adjustmentValue < 1 (legacy). ` +
        'Bỏ qua, không xóa/sửa; các bản ghi này không hiển thị trong danh sách.',
    );
  }

  const fields: FieldSeed[] = [
    {
      model: SeatM,
      keyName: 'seatType',
      fieldKey: SeatType.VIP,
      values: [1.5, 1.7],
      legacyProp: 'vipSeatMultiplier',
    },
    {
      model: SeatM,
      keyName: 'seatType',
      fieldKey: SeatType.COUPLE,
      values: [1.2],
    },
    {
      model: DayM,
      keyName: 'dayType',
      fieldKey: DayType.WEEKEND,
      values: [1.2],
      legacyProp: 'weekendMultiplier',
    },
    {
      model: DayM,
      keyName: 'dayType',
      fieldKey: DayType.HOLIDAY,
      values: [1.5],
      legacyProp: 'holidayMultiplier',
    },
  ];

  // 3. Migrate singleton Revision 1 (không có tiền tố seed)
  const legacyConfig = (await mongoose.connection
    .collection(LEGACY_CONFIG_COLLECTION)
    .findOne({ configKey: 'GLOBAL' })) as Record<string, unknown> | null;
  const legacyConfigId =
    typeof legacyConfig?.configId === 'string' ? legacyConfig.configId : '';
  const hasRealLegacy = legacyConfig !== null && !rx.test(legacyConfigId);
  const migrated = new Set<string>();

  if (hasRealLegacy) {
    for (const f of fields) {
      if (!f.legacyProp) continue;
      const value = legacyConfig[f.legacyProp];
      const exists = await f.model.exists({
        [f.keyName]: f.fieldKey,
        adjustmentValue: { $gte: MULTIPLIER_MIN },
      });
      if (exists || typeof value !== 'number' || value < MULTIPLIER_MIN) {
        continue;
      }
      await f.model.updateOne(
        { [f.keyName]: f.fieldKey, adjustmentValue: value },
        // Dữ liệu thật của người dùng: ruleId UUID, KHÔNG dùng tiền tố seed để --clean không xóa nhầm
        { $setOnInsert: { ruleId: randomUUID() } },
        { upsert: true },
      );
      migrated.add(f.fieldKey);
      console.log(`Migrate ${f.legacyProp} -> ${f.fieldKey}: ${value}`);
    }
    console.log(
      `Đã đọc cấu hình Revision 1. Collection "${LEGACY_CONFIG_COLLECTION}" KHÔNG bị xóa; ` +
        'hãy xóa thủ công khi đã xác nhận (db.price_multiplier_configs.drop()).',
    );
  }

  // 4. Seed minh họa (chỉ khi trường chưa có giá trị nào)
  for (const f of fields) {
    const exists = await f.model.exists({
      [f.keyName]: f.fieldKey,
      adjustmentValue: { $gte: MULTIPLIER_MIN },
    });
    if (exists) {
      if (!migrated.has(f.fieldKey)) {
        console.log(`Trường ${f.fieldKey} đã có giá trị, giữ nguyên.`);
      }
      continue;
    }
    for (const v of f.values) {
      await f.model.updateOne(
        { [f.keyName]: f.fieldKey, adjustmentValue: v },
        { $setOnInsert: { ruleId: `${P}${f.fieldKey.toLowerCase()}-${v}` } },
        { upsert: true },
      );
    }
  }

  // 5. Tài khoản kiểm thử
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: [string, string, string, Role][] = [
    ['admin', 'admin-uc05@cinema.local', 'Admin', Role.ADMIN],
    ['manager', 'manager-uc05@cinema.local', 'Manager', Role.MANAGER],
  ];
  for (const [k, email, lastName, role] of users) {
    // Không ghi đè tài khoản đã có (theo email)
    const found = await UserM.exists({ email });
    if (found) continue;
    await UserM.create({
      userId: P + k,
      email,
      password: passwordHash,
      firstName: 'UC05',
      lastName,
      role,
      isActive: true,
    });
  }

  console.log(
    'Seed xong: VIP 1.5/1.7, COUPLE 1.2, WEEKEND 1.2, HOLIDAY 1.5 (nếu trường chưa có giá trị), 2 tài khoản ADMIN/MANAGER.',
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
