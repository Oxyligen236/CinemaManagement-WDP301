import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BranchStatus, ItemStatus, ComboStatus } from '@prisma/client';
import {
  BranchConcessionCatalogRes,
  BranchConcessionComboRes,
  ProductSummaryRes,
} from '../dto/res.dto';
import { GetBranchConcessionsUsecase } from '../usecase/get-branch-concessions.usecase';
import { DeductConcessionStockUsecase } from '../usecase/deduct-concession-stock.usecase';
import { ItemService } from './item.service';

@Injectable()
export class ProductService
  implements GetBranchConcessionsUsecase, DeductConcessionStockUsecase
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly itemService: ItemService,
  ) {}

  async getBranchConcessions(
    branchId: string,
  ): Promise<BranchConcessionCatalogRes> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        branchStatus: BranchStatus.ACTIVE,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc không còn hoạt động',
      );
    }

    const [items, combos] = await Promise.all([
      this.prisma.item.findMany({
        where: {
          branchId,
          status: ItemStatus.AVAILABLE,
          stockQuantity: { gt: 0 },
        },
      }),
      this.prisma.combo.findMany({
        where: {
          branchId,
          status: ComboStatus.AVAILABLE,
        },
      }),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const storagePublicUrl =
      process.env.STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, '') || '';

    const formatImageUrl = (key?: string | null): string | null => {
      if (!key) return null;
      if (/^https?:\/\//i.test(key)) return key;
      const cleanKey = key.replace(/^\/+/, '');
      return cleanKey ? `${storagePublicUrl}/${cleanKey}` : null;
    };

    const validCombos: BranchConcessionComboRes[] = [];
    for (const combo of combos) {
      const comboItems = (combo.items as any[]) ?? [];
      if (!comboItems || comboItems.length === 0) continue;
      let minStock = Number.MAX_SAFE_INTEGER;
      let canServe = true;

      for (const sub of comboItems) {
        const itemDoc = itemMap.get(sub.itemId);
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
        validCombos.push({
          comboId: combo.id,
          name: combo.name,
          price: combo.price,
          availableStock: minStock,
          imageUrl: formatImageUrl(combo.imageKey),
          description: combo.description || undefined,
          items: comboItems.map((sub) => {
            const doc = itemMap.get(sub.itemId);
            return {
              itemId: sub.itemId,
              name: doc?.name || 'Món',
              quantity: sub.quantity,
            };
          }),
        });
      }
    }

    return {
      branchId: branch.id,
      items: items.map((i) => ({
        itemId: i.id,
        name: i.name,
        category: i.category as any,
        size: (i.size as any) ?? null,
        price: i.price,
        stockQuantity: i.stockQuantity,
        imageUrl: formatImageUrl(i.imageKey),
        description: i.description || undefined,
      })),
      combos: validCombos,
    };
  }

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryRes>> {
    return this.itemService.getProductsByIds(productIds);
  }

  async deductConcessionStock(
    items: Array<{ productId: string; quantity: number }>,
    prismaTx?: any,
  ): Promise<void> {
    if (!items || items.length === 0) return;
    const client = prismaTx ?? this.prisma;

    const deductMap = new Map<string, number>();

    for (const reqItem of items) {
      const singleItem = await client.item.findUnique({
        where: { id: reqItem.productId },
      });

      if (singleItem) {
        deductMap.set(
          singleItem.id,
          (deductMap.get(singleItem.id) ?? 0) + reqItem.quantity,
        );
        continue;
      }

      const combo = await client.combo.findUnique({
        where: { id: reqItem.productId },
      });

      if (combo) {
        for (const sub of (combo.items as any[]) ?? []) {
          deductMap.set(
            sub.itemId,
            (deductMap.get(sub.itemId) ?? 0) + sub.quantity * reqItem.quantity,
          );
        }
      } else {
        throw new NotFoundException(
          `Không tìm thấy sản phẩm ${reqItem.productId} trong hệ thống`,
        );
      }
    }

    for (const [itemId, qty] of deductMap.entries()) {
      const current = await client.item.findUnique({
        where: { id: itemId },
        select: { id: true, name: true, stockQuantity: true, status: true },
      });

      if (!current || current.stockQuantity < qty) {
        const itemName = current?.name || itemId;
        throw new ConflictException(
          `Sản phẩm "${itemName}" không đủ tồn kho để khấu trừ (yêu cầu: ${qty}, hiện có: ${current?.stockQuantity ?? 0})`,
        );
      }

      const nextStock = current.stockQuantity - qty;
      const nextStatus =
        nextStock === 0 && current.status === ItemStatus.AVAILABLE
          ? ItemStatus.OUT_OF_STOCK
          : undefined;

      await client.item.update({
        where: { id: itemId },
        data: {
          stockQuantity: nextStock,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });
    }
  }
}
