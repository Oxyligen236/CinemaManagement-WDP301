import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

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
    const user = await this.userModel
      .findOne({ _id: toObjectId(managerUserId) })
      .exec();
    if (!user || !user.branchId) {
      throw new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH);
    }

    const branch = await this.branchModel
      .findOne({ _id: toObjectId(user.branchId) })
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
    const itemIdStr = (item._id ?? (item as any).itemId)?.toString();
    const branchIdStr = (item.branchId ?? '').toString();

    return ItemRes.from({
      itemId: itemIdStr,
      branchId: branchIdStr,
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
    });
  }

  async createItem(
    managerUserId: string,
    req: CreateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchObjId = branch._id;

    const trimmedName = req.name.trim();
    const existing = await this.itemModel
      .findOne({
        branchId: branchObjId,
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
      branchId: branchObjId,
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
    return ItemMutationRes.from({
      message: CONCESSION_MESSAGES.CREATE_ITEM_SUCCESS,
      item: this.mapToItemRes(saved),
    });
  }

  async updateItem(
    managerUserId: string,
    itemId: string,
    req: UpdateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchObjId = branch._id;
    const itemObjId = toObjectId(itemId);

    const item = await this.itemModel
      .findOne({ _id: itemObjId, branchId: branchObjId })
      .exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    if (req.name && req.name.trim()) {
      const trimmedName = req.name.trim();
      const existing = await this.itemModel
        .findOne({
          branchId: branchObjId,
          _id: { $ne: itemObjId },
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
    return ItemMutationRes.from({
      message: CONCESSION_MESSAGES.UPDATE_ITEM_SUCCESS,
      item: this.mapToItemRes(updated),
    });
  }

  async queryBranchItems(
    managerUserId: string,
    query: QueryBranchItemsReq,
  ): Promise<Page<ItemRes>> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchObjId = branch._id;

    const filter: Record<string, any> = { branchId: branchObjId };

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
      .findOne({ _id: toObjectId(itemId), branchId: branch._id })
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
    const itemObjId = toObjectId(itemId);
    const item = await this.itemModel
      .findOne({ _id: itemObjId, branchId: branch._id })
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

    return StockAdjustmentRes.from({
      message: CONCESSION_MESSAGES.STOCK_UPDATE_SUCCESS,
      itemId: (item._id ?? (item as any).itemId)?.toString(),
      previousStock,
      currentStock: nextStock,
      status: item.status,
    });
  }

  async changeItemStatus(
    managerUserId: string,
    itemId: string,
    req: ChangeItemStatusReq,
  ): Promise<ItemMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const item = await this.itemModel
      .findOne({ _id: toObjectId(itemId), branchId: branch._id })
      .exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    item.status = resolveItemStockStatus(item.stockQuantity, req.status);
    const saved = await item.save();

    return ItemMutationRes.from({
      message: CONCESSION_MESSAGES.STATUS_UPDATE_SUCCESS,
      item: this.mapToItemRes(saved),
    });
  }

  async deleteItem(
    managerUserId: string,
    itemId: string,
  ): Promise<DeleteMutationRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const itemObjId = toObjectId(itemId);
    const item = await this.itemModel
      .findOne({ _id: itemObjId, branchId: branch._id })
      .exec();
    if (!item) {
      throw new NotFoundException(CONCESSION_MESSAGES.ITEM_NOT_FOUND);
    }

    await this.itemModel
      .deleteOne({ _id: itemObjId, branchId: branch._id })
      .exec();

    return DeleteMutationRes.from({
      message: CONCESSION_MESSAGES.DELETE_SUCCESS,
      id: itemId,
    });
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
      { header: 'Giá bán (VNĐ) (*)', key: 'price', width: 20 },
      { header: 'Giá vốn (VNĐ)', key: 'costPrice', width: 20 },
      { header: 'Số lượng tồn (*)', key: 'stockQuantity', width: 20 },
      { header: 'Định mức tối thiểu', key: 'lowStockThreshold', width: 24 },
      { header: 'Mô tả', key: 'description', width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    worksheet.addRow({
      name: 'Bắp rang bơ phô mai',
      category: 'Bắp rang (POPCORN)',
      size: 'Lớn (LARGE)',
      price: 55000,
      costPrice: 20000,
      stockQuantity: 100,
      lowStockThreshold: 15,
      description: 'Bắp rang vị phô mai thơm ngon',
    });

    worksheet.addRow({
      name: 'Nước ngọt có gas Coca',
      category: 'Nước uống (BEVERAGE)',
      size: 'Vừa (MEDIUM)',
      price: 35000,
      costPrice: 10000,
      stockQuantity: 200,
      lowStockThreshold: 30,
      description: 'Ly giấy 22oz',
    });

    const guideSheet = workbook.addWorksheet('HuongDanNhapLieu');
    guideSheet.columns = [
      { header: 'Cột dữ liệu', key: 'col', width: 25 },
      { header: 'Quy định / Giá trị hợp lệ', key: 'rule', width: 60 },
    ];
    const guideHeader = guideSheet.getRow(1);
    guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guideHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    guideHeader.height = 24;

    guideSheet.addRow({
      col: 'Tên món (*)',
      rule: 'Bắt buộc, tối đa 200 ký tự. Không được trùng tên với món khác trong chi nhánh.',
    });
    guideSheet.addRow({
      col: 'Danh mục (*)',
      rule: 'POPCORN (hoặc Bắp rang), DRINK / BEVERAGE (hoặc Nước uống), COMBO, SNACK, OTHER',
    });
    guideSheet.addRow({
      col: 'Kích cỡ',
      rule: 'Không bắt buộc. Nhập: STANDARD / S / Tiêu chuẩn, MEDIUM / M / Vừa, LARGE / L / Lớn, hoặc để trống',
    });
    guideSheet.addRow({
      col: 'Giá bán (VNĐ) (*)',
      rule: 'Số nguyên >= 0',
    });
    guideSheet.addRow({
      col: 'Giá vốn (VNĐ)',
      rule: 'Số nguyên >= 0 (Mặc định: 0)',
    });
    guideSheet.addRow({
      col: 'Số lượng tồn (*)',
      rule: 'Số nguyên >= 0. Nếu = 0 món sẽ tự động ở trạng thái Hết hàng (OUT_OF_STOCK)',
    });
    guideSheet.addRow({
      col: 'Định mức tối thiểu',
      rule: 'Số nguyên >= 0. Cảnh báo sắp hết hàng khi tồn kho <= mức này (Mặc định: 10)',
    });
    guideSheet.addRow({
      col: 'Mô tả',
      rule: 'Tối đa 1000 ký tự',
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  async importItemsExcel(
    managerUserId: string,
    fileBuffer: Buffer,
    req?: ImportItemsExcelReq,
  ): Promise<ImportItemsExcelRes> {
    const branch = await this.validateManagerBranch(managerUserId);
    const branchObjId = branch._id;

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_REQUIRED);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException(CONCESSION_MESSAGES.INVALID_EXCEL_FORMAT);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(CONCESSION_MESSAGES.EMPTY_EXCEL_SHEET);
    }

    const stockMode = req?.stockMode ?? ExcelStockMode.OVERWRITE;
    let totalRows = 0;
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const errors: ExcelRowErrorRes[] = [];

    const rowsToProcess: {
      rowNumber: number;
      nameVal: string;
      categoryVal: unknown;
      sizeVal: unknown;
      priceVal: unknown;
      costVal: unknown;
      stockVal: unknown;
      thresholdVal: unknown;
      descVal: string;
    }[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const nameVal = row.getCell(1).text?.trim();
      const categoryVal = row.getCell(2).value;
      const sizeVal = row.getCell(3).value;
      const priceVal = row.getCell(4).value;
      const costVal = row.getCell(5).value;
      const stockVal = row.getCell(6).value;
      const thresholdVal = row.getCell(7).value;
      const descVal = row.getCell(8).text?.trim();

      if (!nameVal && !categoryVal && !priceVal && !stockVal) {
        return;
      }

      totalRows++;
      rowsToProcess.push({
        rowNumber,
        nameVal,
        categoryVal,
        sizeVal,
        priceVal,
        costVal,
        stockVal,
        thresholdVal,
        descVal,
      });
    });

    for (const itemRow of rowsToProcess) {
      const {
        rowNumber,
        nameVal,
        categoryVal,
        sizeVal,
        priceVal,
        costVal,
        stockVal,
        thresholdVal,
        descVal,
      } = itemRow;

      if (!nameVal) {
        errors.push({
          rowNumber,
          reason: 'Tên món không được để trống',
        });
        continue;
      }

      if (nameVal.length > 200) {
        errors.push({
          rowNumber,
          name: nameVal,
          reason: 'Tên món vượt quá 200 ký tự',
        });
        continue;
      }

      const parsedCategory = parseExcelCategory(
        categoryVal !== null && categoryVal !== undefined
          ? String(categoryVal)
          : null,
      );
      if (!parsedCategory) {
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Danh mục "${String(categoryVal)}" không hợp lệ`,
        });
        continue;
      }

      const parsedSize = parseExcelSize(
        sizeVal !== null && sizeVal !== undefined ? String(sizeVal) : null,
      );
      const parsedPrice = Number(priceVal);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Giá bán "${String(priceVal)}" không hợp lệ (phải >= 0)`,
        });
        continue;
      }

      const parsedStock = Number(stockVal);
      if (
        isNaN(parsedStock) ||
        parsedStock < 0 ||
        !Number.isInteger(parsedStock)
      ) {
        errors.push({
          rowNumber,
          name: nameVal,
          reason: `Số lượng tồn "${String(stockVal)}" không hợp lệ (phải là số nguyên >= 0)`,
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
          branchId: branchObjId,
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
          branchId: branchObjId,
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
    const branchObjId = branch._id;
    const branchIdStr = branchObjId.toString();

    const items = await this.itemModel
      .find({
        branchId: branchObjId,
        status: { $ne: ItemStatus.INACTIVE },
      })
      .select('name category size price stockQuantity')
      .sort({ name: 1 })
      .exec();

    return {
      branch: {
        branchId: branchIdStr,
        branchName: branch.branchName,
        address: branch.address,
      },
      categories: Object.values(ItemCategory),
      sizes: Object.values(ItemSize),
      itemStatuses: Object.values(ItemStatus),
      comboStatuses: Object.values(ComboStatus),
      availableItemsForCombo: items.map((i) => ({
        itemId: (i._id ?? (i as any).itemId)?.toString(),
        name: i.name,
        category: i.category,
        size: i.size ?? null,
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

    const productObjIds = productIds.map(toObjectId);
    const items = await this.itemModel
      .find({ _id: { $in: productObjIds } })
      .exec();

    for (const item of items) {
      const idStr = (item._id ?? (item as any).itemId)?.toString();
      map.set(
        idStr,
        ProductSummaryRes.from({
          productId: idStr,
          productName: item.name,
          imageUrl: this.resolveImageUrl(item.imageKey),
          unitPrice: item.price,
          branchId: item.branchId?.toString(),
        }),
      );
    }

    const remainingIds = productIds.filter((id) => !map.has(id));
    if (remainingIds.length > 0) {
      const remainingObjIds = remainingIds.map(toObjectId);
      const combos = await this.comboModel
        .find({ _id: { $in: remainingObjIds } })
        .exec();

      for (const combo of combos) {
        const idStr = (combo._id ?? (combo as any).comboId)?.toString();
        map.set(
          idStr,
          ProductSummaryRes.from({
            productId: idStr,
            productName: combo.name,
            imageUrl: this.resolveImageUrl(combo.imageKey),
            unitPrice: combo.price,
            branchId: combo.branchId?.toString(),
          }),
        );
      }
    }

    return map;
  }
}
