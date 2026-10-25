import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { Item, ItemDocument } from '../../domain/schemas/item.schema';
import { Combo, ComboDocument } from '../../domain/schemas/combo.schema';
import { User, UserDocument } from '../../../user/domain/schemas/user.schema';
import {
  Branch,
  BranchDocument,
} from '../../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ItemCategory } from '../../domain/enums/item-category.enum';
import { ItemSize } from '../../domain/enums/item-size.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import { StockAdjustmentType } from '../../domain/enums/stock-adjustment-type.enum';
import { ExcelStockMode } from '../../domain/enums/excel-stock-mode.enum';
import {
  CONCESSION_CONSTANTS,
  CONCESSION_MESSAGES,
  escapeRegex,
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
  constructor(
    @InjectModel(Item.name)
    private readonly itemModel: Model<ItemDocument>,
    @InjectModel(Combo.name)
    private readonly comboModel: Model<ComboDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  private async validateManagerBranch(
    managerUserId: string,
  ): Promise<BranchDocument> {
    const user = await this.userModel.findOne({ userId: managerUserId }).exec();
    if (!user || !user.branchId) {
      throw new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH);
    }

    const branch = await this.branchModel
      .findOne({ branchId: user.branchId })
      .exec();
    if (!branch || branch.branchStatus !== BranchStatus.ACTIVE) {
      throw new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH);
    }

    return branch;
  }

  private mapToItemRes(item: ItemDocument | Item): ItemRes {
    const isLowStock =
      item.stockQuantity <= item.lowStockThreshold &&
      item.status !== ItemStatus.INACTIVE;
    return {
      itemId: item.itemId,
      branchId: item.branchId,
      name: item.name,
      category: item.category,
      size: item.size ?? null,
      price: item.price,
      costPrice: item.costPrice ?? 0,
      stockQuantity: item.stockQuantity,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock,
      status: item.status,
      imageKey: item.imageKey ?? null,
      description: item.description ?? null,
      createdAt: item.createdAt ? item.createdAt.toISOString() : undefined,
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
    };
  }

  async createItem(
    managerUserId: string,
    req: CreateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.branchId;

    const trimmedName = req.name.trim();
    const existing = await this.itemModel
      .findOne({
        branchId,
        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
      })
      .exec();

    if (existing) {
      throw new ConflictException(CONCESSION_MESSAGES.DUPLICATE_ITEM_NAME);
    }

    const initialStock = req.stockQuantity ?? 0;
    const initialStatus = resolveItemStockStatus(
      initialStock,
      req.status ?? ItemStatus.AVAILABLE,
    );

    const item = new this.itemModel({
      branchId,
      name: trimmedName,
      category: req.category,
      size: req.size || null,
      price: req.price,
      costPrice: req.costPrice ?? 0,
      stockQuantity: initialStock,
      lowStockThreshold:
        req.lowStockThreshold ??
        CONCESSION_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD,
      status: initialStatus,
      imageKey: imageKey || req.imageKey || null,
      description: req.description?.trim() || null,
    });

    const saved = await item.save();
    return {
      message: CONCESSION_MESSAGES.CREATE_ITEM_SUCCESS,
      item: this.mapToItemRes(saved),
    };
  }

  async updateItem(
    managerUserId: string,
    itemId: string,
    req: UpdateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.branchId;

    const item = await this.itemModel.findOne({ itemId, branchId }).exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    if (req.name && req.name.trim()) {
      const trimmedName = req.name.trim();
      const existing = await this.itemModel
        .findOne({
          branchId,
          itemId: { $ne: itemId },
          name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
        })
        .exec();

      if (existing) {
        throw new ConflictException(CONCESSION_MESSAGES.DUPLICATE_ITEM_NAME);
      }
      item.name = trimmedName;
    }

    if (req.category) {
      item.category = req.category;
    }
    if (req.size !== undefined) {
      item.size = req.size || null;
    }
    if (req.price !== undefined) {
      item.price = req.price;
    }
    if (req.costPrice !== undefined) {
      item.costPrice = req.costPrice;
    }
    if (req.lowStockThreshold !== undefined) {
      item.lowStockThreshold = req.lowStockThreshold;
    }
    if (req.description !== undefined) {
      item.description = req.description ? req.description.trim() : null;
    }
    if (imageKey) {
      item.imageKey = imageKey;
    } else if (req.imageKey !== undefined) {
      item.imageKey = req.imageKey || null;
    }

    if (req.status) {
      item.status = resolveItemStockStatus(item.stockQuantity, req.status);
    }

    const updated = await item.save();
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
    const branchId = branch.branchId;

    const filter: Record<string, any> = { branchId };

    if (query.category) {
      filter.category = query.category;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search && query.search.trim()) {
      filter.name = {
        $regex: escapeRegex(query.search.trim()),
        $options: 'i',
      };
    }
    if (query.lowStockOnly) {
      filter.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
      filter.status = { $ne: ItemStatus.INACTIVE };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);

    const itemDtos = items.map((i) => this.mapToItemRes(i));
    return Page.from(itemDtos, total, page, limit);
  }

  async getItemDetail(managerUserId: string, itemId: string): Promise<ItemRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.itemModel
      .findOne({ itemId, branchId: branch.branchId })
      .exec();
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
    const item = await this.itemModel
      .findOne({ itemId, branchId: branch.branchId })
      .exec();
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

    item.stockQuantity = nextStock;
    item.status = resolveItemStockStatus(nextStock, item.status);
    await item.save();

    return {
      message: CONCESSION_MESSAGES.STOCK_UPDATE_SUCCESS,
      itemId: item.itemId,
      previousStock,
      currentStock: nextStock,
      status: item.status,
    };
  }

  async changeItemStatus(
    managerUserId: string,
    itemId: string,
    req: ChangeItemStatusReq,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.itemModel
      .findOne({ itemId, branchId: branch.branchId })
      .exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    item.status = resolveItemStockStatus(item.stockQuantity, req.status);
    const saved = await item.save();

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
    const item = await this.itemModel
      .findOne({ itemId, branchId: branch.branchId })
      .exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    await this.itemModel
      .deleteOne({ itemId, branchId: branch.branchId })
      .exec();

    return {
      message: CONCESSION_MESSAGES.DELETE_SUCCESS,
      id: itemId,
    };
  }

  async getItemExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CinemaManagement';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('DanhSachSanPham');

    worksheet.columns = [
      { header: 'Tên món (*)', key: 'name', width: 28 },
      { header: 'Danh mục (*)', key: 'category', width: 22 },
      { header: 'Kích cỡ', key: 'size', width: 18 },
      { header: 'Giá bán (*)', key: 'price', width: 16 },
      { header: 'Tồn kho (*)', key: 'stockQuantity', width: 14 },
      { header: 'Ngưỡng cảnh báo', key: 'lowStockThreshold', width: 18 },
      { header: 'Giá vốn', key: 'costPrice', width: 16 },
      { header: 'Mô tả', key: 'description', width: 32 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D2D2D' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow({
      name: 'Bắp rang bơ (L)',
      category: 'POPCORN',
      size: 'LARGE',
      price: 55000,
      stockQuantity: 120,
      lowStockThreshold: 15,
      costPrice: 20000,
      description: 'Bắp rang bơ truyền thống giòn rụm',
    });

    worksheet.addRow({
      name: 'Coca-Cola (L)',
      category: 'BEVERAGE',
      size: 'LARGE',
      price: 35000,
      stockQuantity: 200,
      lowStockThreshold: 20,
      costPrice: 10000,
      description: 'Nước ngọt có ga ly lớn mát lạnh',
    });

    worksheet.addRow({
      name: 'Bim bim Snack khoai tây',
      category: 'SNACK',
      size: 'STANDARD',
      price: 25000,
      stockQuantity: 60,
      lowStockThreshold: 10,
      costPrice: 12000,
      description: 'Snack khoai tây giòn cay',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }

  async importItemsExcel(
    managerUserId: string,
    fileBuffer: Buffer,
    req?: ImportItemsExcelReq,
  ): Promise<ImportItemsExcelRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchId = branch.branchId;

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_EMPTY_FILE);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_EMPTY_FILE);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_EMPTY_FILE);
    }

    const errors: ExcelRowErrorRes[] = [];
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let totalRows = 0;

    const stockMode = req?.stockMode ?? ExcelStockMode.OVERWRITE;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const nameVal = row.getCell(1).text?.trim();
      const catVal = row.getCell(2).text?.trim();
      const sizeVal = row.getCell(3).text?.trim();
      const priceVal = row.getCell(4).value;
      const stockVal = row.getCell(5).value;
      const thresholdVal = row.getCell(6).value;
      const costVal = row.getCell(7).value;
      const descVal = row.getCell(8).text?.trim();

      const isRowEmpty =
        !nameVal &&
        !catVal &&
        !sizeVal &&
        priceVal === null &&
        stockVal === null &&
        !descVal;

      if (isRowEmpty) {
        continue;
      }

      totalRows++;

      if (!nameVal) {
        errors.push({
          rowNumber,
          name: undefined,
          reason: 'Tên món không được để trống.',
        });
        continue;
      }

      const parsedCategory = parseExcelCategory(catVal);
      if (!parsedCategory) {
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Danh mục không hợp lệ (${catVal || 'trống'}). Chấp nhận: POPCORN, BEVERAGE, SNACK, OTHER.`,
        });
        continue;
      }

      const parsedSize = parseExcelSize(sizeVal);

      const parsedPrice = Number(priceVal);
      if (
        priceVal === null ||
        priceVal === undefined ||
        isNaN(parsedPrice) ||
        parsedPrice < 0
      ) {
        const priceStr =
          typeof priceVal === 'string' || typeof priceVal === 'number'
            ? String(priceVal)
            : 'trống';
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Giá bán không hợp lệ (${priceStr}). Phải là số >= 0.`,
        });
        continue;
      }

      const parsedStock = Number(stockVal ?? 0);
      if (isNaN(parsedStock) || parsedStock < 0) {
        const stockStr =
          typeof stockVal === 'string' || typeof stockVal === 'number'
            ? String(stockVal)
            : 'trống';
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Tồn kho không hợp lệ (${stockStr}). Phải là số nguyên >= 0.`,
        });
        continue;
      }

      const parsedThreshold = Number(thresholdVal);
      const lowStockThreshold =
        !isNaN(parsedThreshold) && parsedThreshold >= 0
          ? parsedThreshold
          : CONCESSION_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD;

      const parsedCost = Number(costVal);
      const costPrice = !isNaN(parsedCost) && parsedCost >= 0 ? parsedCost : 0;

      const existing = await this.itemModel
        .findOne({
          branchId,
          name: { $regex: new RegExp(`^${escapeRegex(nameVal)}$`, 'i') },
        })
        .exec();

      if (existing) {
        existing.category = parsedCategory;
        if (parsedSize !== null) {
          existing.size = parsedSize;
        }
        existing.price = parsedPrice;
        existing.costPrice = costPrice;
        existing.lowStockThreshold = lowStockThreshold;
        if (descVal) {
          existing.description = descVal;
        }

        const nextStock =
          stockMode === ExcelStockMode.ACCUMULATE
            ? existing.stockQuantity + parsedStock
            : parsedStock;

        existing.stockQuantity = nextStock;
        existing.status = resolveItemStockStatus(nextStock, existing.status);

        await existing.save();
        updatedCount++;
      } else {
        const initialStatus = resolveItemStockStatus(
          parsedStock,
          ItemStatus.AVAILABLE,
        );

        const newItem = new this.itemModel({
          itemId: randomUUID(),
          branchId,
          name: nameVal,
          category: parsedCategory,
          size: parsedSize,
          price: parsedPrice,
          costPrice,
          stockQuantity: parsedStock,
          lowStockThreshold,
          status: initialStatus,
          description: descVal || null,
        });

        await newItem.save();
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
    const branchId = branch.branchId;

    const items = await this.itemModel
      .find({
        branchId,
        status: { $ne: ItemStatus.INACTIVE },
      })
      .select('itemId name category size price stockQuantity')
      .sort({ name: 1 })
      .exec();

    return {
      branch: {
        branchId,
        branchName: branch.branchName,
        address: branch.address,
      },
      categories: Object.values(ItemCategory),
      sizes: Object.values(ItemSize),
      itemStatuses: Object.values(ItemStatus),
      comboStatuses: Object.values(ComboStatus),
      availableItemsForCombo: items.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        category: i.category,
        size: i.size ?? null,
        price: i.price,
        stockQuantity: i.stockQuantity,
      })),
    };
  }

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryRes>> {
    const map = new Map<string, ProductSummaryRes>();
    if (!productIds || productIds.length === 0) {
      return map;
    }

    const items = await this.itemModel
      .find({ itemId: { $in: productIds } })
      .exec();

    for (const item of items) {
      map.set(item.itemId, {
        productId: item.itemId,
        productName: item.name,
        imageUrl: item.imageKey || undefined,
        unitPrice: item.price,
        branchId: item.branchId,
      });
    }

    const remainingIds = productIds.filter((id) => !map.has(id));
    if (remainingIds.length > 0) {
      const combos = await this.comboModel
        .find({ comboId: { $in: remainingIds } })
        .exec();

      for (const combo of combos) {
        map.set(combo.comboId, {
          productId: combo.comboId,
          productName: combo.name,
          imageUrl: combo.imageKey || undefined,
          unitPrice: combo.price,
          branchId: combo.branchId,
        });
      }
    }

    return map;
  }
}
