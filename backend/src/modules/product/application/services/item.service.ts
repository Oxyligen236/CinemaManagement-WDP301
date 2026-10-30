import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import ExcelJS from 'exceljs';
import {
  BranchStatus,
  ItemStatus,
  ItemCategory,
  ItemSize,
  ComboStatus,
} from '@prisma/client';
import { StockAdjustmentType } from '../../domain/enums/stock-adjustment-type.enum';
import { ExcelStockMode } from '../../domain/enums/excel-stock-mode.enum';
import {
  CONCESSION_CONSTANTS,
  CONCESSION_MESSAGES,
  parseExcelCategory,
  parseExcelSize,
  resolveItemStockStatus,
} from '../../domain/concession.rules';
import {
  AdjustItemStockReq,
  ChangeItemStatusReq,
  CreateItemReq,
  ImportItemsExcelReq,
  QueryBranchItemsReq,
  UpdateItemReq,
} from '../dto/req.dto';
import {
  ConcessionOptionsRes,
  DeleteMutationRes,
  ExcelRowErrorRes,
  ImportItemsExcelRes,
  ItemMutationRes,
  ItemRes,
  ProductSummaryRes,
  StockAdjustmentRes,
} from '../dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';
import { CreateItemUsecase } from '../usecase/create-item.usecase';
import { UpdateItemUsecase } from '../usecase/update-item.usecase';
import { QueryBranchItemsUsecase } from '../usecase/query-branch-items.usecase';
import { GetItemDetailUsecase } from '../usecase/get-item-detail.usecase';
import { AdjustItemStockUsecase } from '../usecase/adjust-item-stock.usecase';
import { ChangeItemStatusUsecase } from '../usecase/change-item-status.usecase';
import { DeleteItemUsecase } from '../usecase/delete-item.usecase';
import { ImportItemsExcelUsecase } from '../usecase/import-items-excel.usecase';
import { GetItemExcelTemplateUsecase } from '../usecase/get-item-excel-template.usecase';
import { GetConcessionOptionsUsecase } from '../usecase/get-concession-options.usecase';

@Injectable()
export class ItemService
  implements
    CreateItemUsecase,
    UpdateItemUsecase,
    QueryBranchItemsUsecase,
    GetItemDetailUsecase,
    AdjustItemStockUsecase,
    ChangeItemStatusUsecase,
    DeleteItemUsecase,
    ImportItemsExcelUsecase,
    GetItemExcelTemplateUsecase,
    GetConcessionOptionsUsecase
{
  constructor(private readonly prisma: PrismaService) {}

  private async validateManagerBranch(managerUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: { branchId: true },
    });
    if (!user || !user.branchId) {
      throw new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH);
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: user.branchId, branchStatus: BranchStatus.ACTIVE },
    });
    if (!branch) {
      throw new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH);
    }

    return branch;
  }

  private mapToItemRes(item: any): ItemRes {
    const isLowStock =
      item.stockQuantity <= item.lowStockThreshold &&
      item.status !== ItemStatus.INACTIVE;
    return {
      itemId: item.id,
      branchId: item.branchId,
      name: item.name,
      category: item.category as any,
      size: item.size ?? null,
      price: item.price,
      costPrice: item.costPrice ?? 0,
      stockQuantity: item.stockQuantity,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock,
      status: item.status as any,
      imageKey: item.imageKey ?? null,
      description: item.description ?? null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
    };
  }

  async createItem(
    managerUserId: string,
    req: CreateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.id;

    const trimmedName = req.name.trim();
    const existing = await this.prisma.item.findFirst({
      where: {
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(CONCESSION_MESSAGES.DUPLICATE_ITEM_NAME);
    }

    const initialStock = req.stockQuantity ?? 0;
    const initialStatus = resolveItemStockStatus(
      initialStock,
      (req.status as any) ?? ItemStatus.AVAILABLE,
    );

    const item = await this.prisma.item.create({
      data: {
        branchId,
        name: trimmedName,
        category: req.category as ItemCategory,
        size: (req.size as ItemSize) || null,
        price: req.price,
        costPrice: req.costPrice ?? 0,
        stockQuantity: initialStock,
        lowStockThreshold:
          req.lowStockThreshold ??
          CONCESSION_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD,
        status: initialStatus as ItemStatus,
        imageKey: imageKey || req.imageKey || null,
        description: req.description?.trim() || null,
      },
    });

    return {
      message: CONCESSION_MESSAGES.CREATE_ITEM_SUCCESS,
      item: this.mapToItemRes(item),
    };
  }

  async updateItem(
    managerUserId: string,
    itemId: string,
    req: UpdateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.id;

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, branchId },
    });
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    const data: any = {};

    if (req.name && req.name.trim()) {
      const trimmedName = req.name.trim();
      const existing = await this.prisma.item.findFirst({
        where: {
          branchId,
          id: { not: itemId },
          name: { equals: trimmedName, mode: 'insensitive' },
        },
      });

      if (existing) {
        throw new ConflictException(CONCESSION_MESSAGES.DUPLICATE_ITEM_NAME);
      }
      data.name = trimmedName;
    }

    if (req.category) data.category = req.category;
    if (req.size !== undefined) data.size = req.size || null;
    if (req.price !== undefined) data.price = req.price;
    if (req.costPrice !== undefined) data.costPrice = req.costPrice;
    if (req.lowStockThreshold !== undefined) data.lowStockThreshold = req.lowStockThreshold;
    if (req.description !== undefined) {
      data.description = req.description ? req.description.trim() : null;
    }
    if (imageKey) {
      data.imageKey = imageKey;
    } else if (req.imageKey !== undefined) {
      data.imageKey = req.imageKey || null;
    }

    if (req.status) {
      data.status = resolveItemStockStatus(item.stockQuantity, req.status as any);
    }

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data,
    });

    return {
      message: CONCESSION_MESSAGES.UPDATE_ITEM_SUCCESS,
      item: this.mapToItemRes(updated),
    };
  }

  async queryBranchItems(
    managerUserId: string,
    query: QueryBranchItemsReq,
  ): Promise<Page<ItemRes>> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.id;

    const where: any = { branchId };

    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    let items = await this.prisma.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: query.lowStockOnly ? undefined : skip,
      take: query.lowStockOnly ? undefined : limit,
    });

    if (query.lowStockOnly) {
      items = items.filter(
        (i) => i.status !== ItemStatus.INACTIVE && i.stockQuantity <= i.lowStockThreshold,
      );
    }

    const total = query.lowStockOnly
      ? items.length
      : await this.prisma.item.count({ where });

    const pagedItems = query.lowStockOnly
      ? items.slice(skip, skip + limit)
      : items;

    const itemDtos = pagedItems.map((i) => this.mapToItemRes(i));
    return Page.from(itemDtos, total, page, limit);
  }

  async getItemDetail(managerUserId: string, itemId: string): Promise<ItemRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, branchId: branch.id },
    });
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }
    return this.mapToItemRes(item);
  }

  async adjustItemStock(
    managerUserId: string,
    itemId: string,
    req: AdjustItemStockReq,
  ): Promise<StockAdjustmentRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, branchId: branch.id },
    });
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    const previousStock = item.stockQuantity;
    let nextStock = previousStock;

    if (req.adjustmentType === StockAdjustmentType.ADD) {
      nextStock = previousStock + req.quantity;
    } else if (req.adjustmentType === StockAdjustmentType.SET) {
      nextStock = req.quantity;
    } else if (req.adjustmentType === StockAdjustmentType.SUBTRACT) {
      nextStock = previousStock - req.quantity;
      if (nextStock < 0) {
        throw new BadRequestException(
          CONCESSION_MESSAGES.STOCK_CANNOT_BE_NEGATIVE,
        );
      }
    } else {
      throw new BadRequestException(
        CONCESSION_MESSAGES.INVALID_STOCK_ADJUSTMENT,
      );
    }

    const status = resolveItemStockStatus(nextStock, item.status as any) as ItemStatus;

    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        stockQuantity: nextStock,
        status,
      },
    });

    return {
      message: CONCESSION_MESSAGES.STOCK_UPDATE_SUCCESS,
      itemId: item.id,
      previousStock,
      currentStock: nextStock,
      status: status as any,
    };
  }

  async changeItemStatus(
    managerUserId: string,
    itemId: string,
    req: ChangeItemStatusReq,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, branchId: branch.id },
    });
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    const status = resolveItemStockStatus(item.stockQuantity, req.status as any) as ItemStatus;
    const saved = await this.prisma.item.update({
      where: { id: itemId },
      data: { status },
    });

    return {
      message: CONCESSION_MESSAGES.STATUS_UPDATE_SUCCESS,
      item: this.mapToItemRes(saved),
    };
  }

  async deleteItem(
    managerUserId: string,
    itemId: string,
  ): Promise<DeleteMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, branchId: branch.id },
    });
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    await this.prisma.item.delete({ where: { id: itemId } });

    return {
      message: CONCESSION_MESSAGES.DELETE_SUCCESS,
      id: itemId,
    };
  }

  async getItemExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách món ăn & nước uống');

    worksheet.columns = [
      { header: 'Tên món (*)', key: 'name', width: 30 },
      { header: 'Danh mục (*)', key: 'category', width: 15 },
      { header: 'Kích cỡ', key: 'size', width: 15 },
      { header: 'Giá bán (*)', key: 'price', width: 15 },
      { header: 'Giá nhập', key: 'costPrice', width: 15 },
      { header: 'Tồn kho ban đầu (*)', key: 'stockQuantity', width: 20 },
      { header: 'Ngưỡng cảnh báo', key: 'lowStockThreshold', width: 18 },
      { header: 'Mô tả', key: 'description', width: 35 },
    ];

    worksheet.addRow({
      name: 'Bắp rang bơ phô mai',
      category: 'POPCORN',
      size: 'LARGE',
      price: 65000,
      costPrice: 20000,
      stockQuantity: 100,
      lowStockThreshold: 10,
      description: 'Bắp rang giòn thơm vị phô mai hảo hạng',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importItemsExcel(
    managerUserId: string,
    fileBuffer: Buffer,
    req?: ImportItemsExcelReq,
  ): Promise<ImportItemsExcelRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.id;

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY);
    }

    const errors: ExcelRowErrorRes[] = [];
    const stockMode = req?.stockMode || ExcelStockMode.OVERWRITE;
    let totalRows = 0;
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    const rowCount = worksheet.rowCount;
    if (rowCount <= 1) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY);
    }

    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const nameVal = row.getCell(1).text?.trim();
      const catVal = row.getCell(2).text?.trim();
      const sizeVal = row.getCell(3).text?.trim();
      const priceVal = row.getCell(4).value;
      const costVal = row.getCell(5).value;
      const stockVal = row.getCell(6).value;
      const thresholdVal = row.getCell(7).value;
      const descVal = row.getCell(8).text?.trim();

      if (!nameVal && !catVal && priceVal === null && stockVal === null) {
        continue;
      }

      totalRows++;

      if (!nameVal) {
        errors.push({ rowNumber, reason: CONCESSION_MESSAGES.ITEM_NAME_REQUIRED });
        continue;
      }

      const parsedCategory = parseExcelCategory(catVal);
      if (!parsedCategory) {
        errors.push({ rowNumber, reason: CONCESSION_MESSAGES.INVALID_CATEGORY });
        continue;
      }

      const parsedSize = parseExcelSize(sizeVal);
      const parsedPrice = Number(priceVal);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        errors.push({ rowNumber, reason: CONCESSION_MESSAGES.PRICE_POSITIVE });
        continue;
      }

      const parsedStock = Number(stockVal);
      if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
        errors.push({ rowNumber, reason: CONCESSION_MESSAGES.STOCK_POSITIVE_INT });
        continue;
      }

      const parsedThreshold = Number(thresholdVal);
      const lowStockThreshold =
        !isNaN(parsedThreshold) && parsedThreshold >= 0
          ? parsedThreshold
          : CONCESSION_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD;

      const parsedCost = Number(costVal);
      const costPrice = !isNaN(parsedCost) && parsedCost >= 0 ? parsedCost : 0;

      const existing = await this.prisma.item.findFirst({
        where: {
          branchId,
          name: { equals: nameVal, mode: 'insensitive' },
        },
      });

      if (existing) {
        const nextStock =
          stockMode === ExcelStockMode.ACCUMULATE
            ? existing.stockQuantity + parsedStock
            : parsedStock;

        const status = resolveItemStockStatus(nextStock, existing.status as any) as ItemStatus;

        await this.prisma.item.update({
          where: { id: existing.id },
          data: {
            category: parsedCategory as ItemCategory,
            size: parsedSize !== null ? (parsedSize as ItemSize) : undefined,
            price: parsedPrice,
            costPrice,
            lowStockThreshold,
            description: descVal || undefined,
            stockQuantity: nextStock,
            status,
          },
        });
        updatedCount++;
      } else {
        const initialStatus = resolveItemStockStatus(
          parsedStock,
          ItemStatus.AVAILABLE as any,
        ) as ItemStatus;

        await this.prisma.item.create({
          data: {
            branchId,
            name: nameVal,
            category: parsedCategory as ItemCategory,
            size: parsedSize as ItemSize,
            price: parsedPrice,
            costPrice,
            stockQuantity: parsedStock,
            lowStockThreshold,
            status: initialStatus,
            description: descVal || null,
          },
        });
        createdCount++;
      }

      successCount++;
    }

    return {
      message: CONCESSION_MESSAGES.IMPORT_EXCEL_SUCCESS,
      totalRows,
      successCount,
      errorCount: errors.length,
      createdCount,
      updatedCount,
      errors,
    };
  }

  async getConcessionOptions(
    managerUserId: string,
  ): Promise<ConcessionOptionsRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.id;

    const items = await this.prisma.item.findMany({
      where: {
        branchId,
        status: { not: ItemStatus.INACTIVE },
      },
      select: { id: true, name: true, category: true, size: true, price: true, stockQuantity: true },
      orderBy: { name: 'asc' },
    });

    return {
      branch: {
        branchId,
        branchName: branch.branchName,
        address: branch.address,
      },
      categories: Object.values(ItemCategory) as any,
      sizes: Object.values(ItemSize) as any,
      itemStatuses: Object.values(ItemStatus) as any,
      comboStatuses: Object.values(ComboStatus) as any,
      availableItemsForCombo: items.map((i) => ({
        itemId: i.id,
        name: i.name,
        category: i.category as any,
        size: (i.size as any) ?? null,
        price: i.price,
        stockQuantity: i.stockQuantity,
      })),
    };
  }

  private resolveImageUrl(
    image: string | null | undefined,
  ): string | undefined {
    if (!image) return undefined;
    const value = image.trim();
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    const base = process.env.STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, '');
    if (!base) return undefined;
    const key = value.replace(/^\/+/, '');
    return key ? `${base}/${key}` : undefined;
  }

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryRes>> {
    const map = new Map<string, ProductSummaryRes>();
    if (!productIds || productIds.length === 0) {
      return map;
    }

    const items = await this.prisma.item.findMany({
      where: { id: { in: productIds } },
    });

    for (const item of items) {
      map.set(item.id, {
        productId: item.id,
        productName: item.name,
        imageUrl: this.resolveImageUrl(item.imageKey),
        unitPrice: item.price,
        branchId: item.branchId,
      });
    }

    const remainingIds = productIds.filter((id) => !map.has(id));
    if (remainingIds.length > 0) {
      const combos = await this.prisma.combo.findMany({
        where: { id: { in: remainingIds } },
      });

      for (const combo of combos) {
        map.set(combo.id, {
          productId: combo.id,
          productName: combo.name,
          imageUrl: this.resolveImageUrl(combo.imageKey),
          unitPrice: combo.price,
          branchId: combo.branchId,
        });
      }
    }

    return map;
  }
}
