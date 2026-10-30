import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientSession } from 'mongoose';
import { Item, ItemDocument } from '../../domain/schemas/item.schema';
import { Combo, ComboDocument } from '../../domain/schemas/combo.schema';
import {
  Branch,
  BranchDocument,
} from '../../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import {
  BranchConcessionCatalogRes,
  BranchConcessionComboItemRes,
  BranchConcessionComboRes,
  BranchConcessionItemRes,
  ProductSummaryRes,
} from '../dto/res.dto';
import { GetBranchConcessionsUsecase } from '../usecase/get-branch-concessions.usecase';
import { DeductConcessionStockUsecase } from '../usecase/deduct-concession-stock.usecase';
import { ItemService } from './item.service';

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

@Injectable()
export class ProductService
  implements GetBranchConcessionsUsecase, DeductConcessionStockUsecase
{
  constructor(
    @InjectModel(Item.name)
    private readonly itemModel: Model<ItemDocument>,
    @InjectModel(Combo.name)
    private readonly comboModel: Model<ComboDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    private readonly itemService: ItemService,
  ) {}

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryRes>> {
    return this.itemService.getProductsByIds(productIds);
  }

  async getBranchConcessions(
    branchId: string,
  ): Promise<BranchConcessionCatalogRes> {
    const branch = await this.branchModel
      .findOne({
        _id: toObjectId(branchId),
        branchStatus: BranchStatus.ACTIVE,
      })
      .lean()
      .exec();
    if (!branch) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc đã ngừng hoạt động',
      );
    }

    const items = await this.itemModel
      .find({
        branchId: toObjectId(branchId),
        status: ItemStatus.AVAILABLE,
        stockQuantity: { $gt: 0 },
      })
      .sort({ name: 1 })
      .lean()
      .exec();

    const combos = await this.comboModel
      .find({
        branchId: toObjectId(branchId),
        status: ComboStatus.AVAILABLE,
      })
      .lean()
      .exec();

    const comboItemIds = Array.from(
      new Set(
        combos.flatMap((c) => (c.items || []).map((i) => i.itemId.toString())),
      ),
    );

    const relatedItems = await this.itemModel
      .find({ _id: { $in: comboItemIds.map((id) => toObjectId(id)) } })
      .lean()
      .exec();

    const itemMap = new Map<string, (typeof relatedItems)[0]>();
    for (const it of relatedItems) {
      const itId = (it._id ?? (it as any).itemId)?.toString();
      if (itId) {
        itemMap.set(itId, it);
      }
    }

    const storagePublicUrl =
      process.env.STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, '') || '';
    const resolveImageUrl = (key?: string | null): string | null => {
      if (!key) return null;
      const trimmed = key.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (!storagePublicUrl) return null;
      const cleanKey = trimmed.replace(/^\/+/, '');
      return cleanKey ? `${storagePublicUrl}/${cleanKey}` : null;
    };

    const validCombos: BranchConcessionComboRes[] = [];
    for (const combo of combos) {
      if (!combo.items || combo.items.length === 0) continue;
      let minStock = Number.MAX_SAFE_INTEGER;
      let canServe = true;

      for (const sub of combo.items) {
        const subItemIdStr = sub.itemId.toString();
        const itemDoc = itemMap.get(subItemIdStr);
        if (
          !itemDoc ||
          itemDoc.status !== ItemStatus.AVAILABLE ||
          itemDoc.stockQuantity < sub.quantity
        ) {
          canServe = false;
          break;
        }
        const possible = Math.floor(itemDoc.stockQuantity / sub.quantity);
        if (possible < minStock) {
          minStock = possible;
        }
      }

      if (canServe && minStock > 0 && minStock !== Number.MAX_SAFE_INTEGER) {
        const comboIdStr = (combo._id ?? (combo as any).comboId)?.toString();
        validCombos.push(
          BranchConcessionComboRes.from({
            comboId: comboIdStr,
            name: combo.name,
            price: combo.price,
            availableStock: minStock,
            imageKey: combo.imageKey ?? null,
            imageUrl: resolveImageUrl(combo.imageKey),
            description: combo.description ?? null,
            items: combo.items.map((it) => {
              const subIdStr = it.itemId.toString();
              return BranchConcessionComboItemRes.from({
                itemId: subIdStr,
                name: itemMap.get(subIdStr)?.name || 'Món con',
                quantity: it.quantity,
              });
            }),
          }),
        );
      }
    }

    return BranchConcessionCatalogRes.from({
      branchId,
      items: items.map((it) => {
        const itemIdStr = (it._id ?? (it as any).itemId)?.toString();
        return BranchConcessionItemRes.from({
          itemId: itemIdStr,
          name: it.name,
          category: it.category,
          size: it.size ?? null,
          price: it.price,
          stockQuantity: it.stockQuantity,
          imageKey: it.imageKey ?? null,
          imageUrl: resolveImageUrl(it.imageKey),
          description: it.description ?? null,
        });
      }),
      combos: validCombos,
    });
  }

  async deductConcessionStock(
    items: Array<{ productId: string; quantity: number }>,
    session?: ClientSession,
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const productIds = items.map((i) => i.productId);
    const productObjIds = productIds.map((id) => toObjectId(id));
    const [foundItems, foundCombos] = await Promise.all([
      this.itemModel
        .find({ _id: { $in: productObjIds } })
        .lean()
        .exec(),
      this.comboModel
        .find({ _id: { $in: productObjIds } })
        .lean()
        .exec(),
    ]);

    const itemIdsSet = new Set(
      foundItems.map((i) => (i._id ?? (i as any).itemId)?.toString()),
    );
    const comboMap = new Map(
      foundCombos.map((c) => [(c._id ?? (c as any).comboId)?.toString(), c]),
    );

    const deductMap = new Map<string, number>();

    for (const reqItem of items) {
      if (reqItem.quantity <= 0) continue;
      if (itemIdsSet.has(reqItem.productId)) {
        deductMap.set(
          reqItem.productId,
          (deductMap.get(reqItem.productId) || 0) + reqItem.quantity,
        );
      } else if (comboMap.has(reqItem.productId)) {
        const combo = comboMap.get(reqItem.productId)!;
        for (const sub of combo.items || []) {
          const subItemIdStr = sub.itemId.toString();
          deductMap.set(
            subItemIdStr,
            (deductMap.get(subItemIdStr) || 0) +
              sub.quantity * reqItem.quantity,
          );
        }
      } else {
        throw new NotFoundException(
          `Không tìm thấy sản phẩm ${reqItem.productId} trong hệ thống`,
        );
      }
    }

    for (const [itemId, qty] of deductMap.entries()) {
      const itemObjId = toObjectId(itemId);
      const updated = await this.itemModel
        .findOneAndUpdate(
          {
            _id: itemObjId,
            stockQuantity: { $gte: qty },
          },
          {
            $inc: { stockQuantity: -qty },
          },
          { new: true, session },
        )
        .exec();

      if (!updated) {
        const currentQuery = this.itemModel
          .findById(itemObjId)
          .select('name stockQuantity')
          .lean();
        if (session) currentQuery.session(session);
        const current = await currentQuery.exec();
        const itemName = current?.name || itemId;
        throw new ConflictException(
          `Sản phẩm "${itemName}" không đủ tồn kho để khấu trừ (yêu cầu: ${qty}, hiện có: ${current?.stockQuantity ?? 0})`,
        );
      }

      if (
        updated.stockQuantity === 0 &&
        updated.status === ItemStatus.AVAILABLE
      ) {
        const statusUpdate = this.itemModel.updateOne(
          { _id: itemObjId },
          { $set: { status: ItemStatus.OUT_OF_STOCK } },
          session ? { session } : {},
        );
        await statusUpdate.exec();
      }
    }
  }
}
