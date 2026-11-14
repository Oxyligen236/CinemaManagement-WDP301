import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ComboStatus,
  ItemCategory,
  ItemSize,
  ItemStatus,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CONCESSION_MESSAGES } from '../../domain/concession.rules';
import { ExcelStockMode } from '../../domain/enums/excel-stock-mode.enum';
import { StockAdjustmentType } from '../../domain/enums/stock-adjustment-type.enum';
import {
  ChangeItemStatusReq,
  CreateItemReq,
  QueryBranchItemsReq,
  UpdateItemReq,
} from '../dto/req.dto';
import { ItemService } from './item.service';

describe('ItemService', () => {
  let service: ItemService;
  let prisma: {
    user: { findUnique: jest.Mock };
    branch: { findFirst: jest.Mock };
    item: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    combo: { findMany: jest.Mock };
  };

  const managerId = 'mgr-1';
  const branchId = 'branch-1';
  const branchDoc = {
    id: branchId,
    branchName: 'Chi nhánh Q1',
    address: '123 Lê Lợi',
  };
  const now = new Date('2026-11-01T10:00:00Z');

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      branch: { findFirst: jest.fn() },
      item: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      combo: { findMany: jest.fn() },
    };
    service = new ItemService(prisma as unknown as PrismaService);
  });

  const mockValidManagerBranch = () => {
    prisma.user.findUnique.mockResolvedValue({ branchId });
    prisma.branch.findFirst.mockResolvedValue(branchDoc);
  };

  describe('validateManagerBranch', () => {
    it('throws ForbiddenException when user is missing or has no branchId', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.getConcessionOptions(managerId)).rejects.toThrow(
        new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH),
      );

      prisma.user.findUnique.mockResolvedValueOnce({ branchId: null });
      await expect(service.getConcessionOptions(managerId)).rejects.toThrow(
        new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH),
      );
    });

    it('throws ForbiddenException when branch is not found or inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId });
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.getConcessionOptions(managerId)).rejects.toThrow(
        new ForbiddenException(CONCESSION_MESSAGES.NO_BRANCH),
      );
    });
  });

  describe('createItem', () => {
    it('throws ConflictException when item name already exists in branch', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({ id: 'item-dup' });

      await expect(
        service.createItem(managerId, {
          name: 'Bắp phô mai',
          category:
            ItemCategory.POPCORN as unknown as CreateItemReq['category'],
          price: 55000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates item with explicit values and imageKey param', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);
      prisma.item.create.mockResolvedValue({
        id: 'item-1',
        branchId,
        name: 'Bắp phô mai',
        category: ItemCategory.POPCORN,
        size: ItemSize.LARGE,
        price: 65000,
        costPrice: 25000,
        stockQuantity: 20,
        lowStockThreshold: 5,
        status: ItemStatus.AVAILABLE,
        imageKey: 'concessions/pop.png',
        description: 'Thơm ngon',
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.createItem(
        managerId,
        {
          name: '  Bắp phô mai  ',
          category:
            ItemCategory.POPCORN as unknown as CreateItemReq['category'],
          size: ItemSize.LARGE as unknown as CreateItemReq['size'],
          price: 65000,
          costPrice: 25000,
          stockQuantity: 20,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE as unknown as CreateItemReq['status'],
          description: '  Thơm ngon  ',
        },
        'concessions/pop.png',
      );

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          branchId,
          name: 'Bắp phô mai',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 65000,
          costPrice: 25000,
          stockQuantity: 20,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
          imageKey: 'concessions/pop.png',
          description: 'Thơm ngon',
        },
      });
      expect(res.message).toBe(CONCESSION_MESSAGES.CREATE_ITEM_SUCCESS);
      expect(res.item.isLowStock).toBe(false);
      expect(res.item.createdAt).toBe(now.toISOString());
    });

    it('creates item with defaults when optional fields omitted and sets OUT_OF_STOCK when stock is 0', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);
      prisma.item.create.mockResolvedValue({
        id: 'item-2',
        branchId,
        name: 'Nước suối',
        category: ItemCategory.BEVERAGE,
        size: null,
        price: 20000,
        costPrice: null,
        stockQuantity: 0,
        lowStockThreshold: 10,
        status: ItemStatus.OUT_OF_STOCK,
        imageKey: 'req-img.png',
        description: null,
      });

      const res = await service.createItem(managerId, {
        name: 'Nước suối',
        category: ItemCategory.BEVERAGE as unknown as CreateItemReq['category'],
        price: 20000,
        imageKey: 'req-img.png',
      });

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          branchId,
          name: 'Nước suối',
          category: ItemCategory.BEVERAGE,
          size: null,
          price: 20000,
          costPrice: 0,
          stockQuantity: 0,
          lowStockThreshold: 10,
          status: ItemStatus.OUT_OF_STOCK,
          imageKey: 'req-img.png',
          description: null,
        },
      });
      expect(res.item.isLowStock).toBe(true);
      expect(res.item.costPrice).toBe(0);
      expect(res.item.createdAt).toBeUndefined();

      prisma.item.create.mockResolvedValueOnce({
        id: 'item-3',
        branchId,
        name: 'Snack',
        category: ItemCategory.SNACK,
        size: null,
        price: 15000,
        costPrice: 0,
        stockQuantity: 0,
        lowStockThreshold: 10,
        status: ItemStatus.INACTIVE,
        imageKey: null,
        description: null,
      });
      const resNoImg = await service.createItem(managerId, {
        name: 'Snack',
        category: ItemCategory.SNACK as unknown as CreateItemReq['category'],
        price: 15000,
        status: ItemStatus.INACTIVE as unknown as CreateItemReq['status'],
      });
      expect(resNoImg.item.imageKey).toBeNull();
      expect(resNoImg.item.isLowStock).toBe(false);
    });
  });

  describe('updateItem', () => {
    it('throws NotFoundException when item does not exist in branch', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem(managerId, 'item-404', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to duplicate name', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst
        .mockResolvedValueOnce({ id: 'item-1', branchId, stockQuantity: 10 })
        .mockResolvedValueOnce({ id: 'item-2', name: 'Existing' });

      await expect(
        service.updateItem(managerId, 'item-1', { name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates all fields with uploaded imageKey and resolves status', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst
        .mockResolvedValueOnce({ id: 'item-1', branchId, stockQuantity: 10 })
        .mockResolvedValueOnce(null);
      prisma.item.update.mockResolvedValue({
        id: 'item-1',
        branchId,
        name: 'New Name',
        category: ItemCategory.SNACK,
        size: ItemSize.MEDIUM,
        price: 30000,
        costPrice: 15000,
        stockQuantity: 10,
        lowStockThreshold: 5,
        status: ItemStatus.AVAILABLE,
        imageKey: 'new.png',
        description: 'Updated desc',
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.updateItem(
        managerId,
        'item-1',
        {
          name: '  New Name  ',
          category: ItemCategory.SNACK as unknown as UpdateItemReq['category'],
          size: ItemSize.MEDIUM as unknown as UpdateItemReq['size'],
          price: 30000,
          costPrice: 15000,
          lowStockThreshold: 5,
          description: '  Updated desc  ',
          status: ItemStatus.AVAILABLE as unknown as UpdateItemReq['status'],
        },
        'new.png',
      );

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          name: 'New Name',
          category: ItemCategory.SNACK,
          size: ItemSize.MEDIUM,
          price: 30000,
          costPrice: 15000,
          lowStockThreshold: 5,
          description: 'Updated desc',
          imageKey: 'new.png',
          status: ItemStatus.AVAILABLE,
        },
      });
      expect(res.message).toBe(CONCESSION_MESSAGES.UPDATE_ITEM_SUCCESS);
      expect(res.item.createdAt).toBe(now.toISOString());
    });

    it('handles clearing nullable fields and skipping blank name', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        branchId,
        stockQuantity: 0,
      });
      prisma.item.update.mockResolvedValue({
        id: 'item-1',
        branchId,
        name: 'Old Name',
        category: ItemCategory.OTHER,
        size: null,
        price: 10000,
        costPrice: null,
        stockQuantity: 0,
        lowStockThreshold: 10,
        status: ItemStatus.OUT_OF_STOCK,
        imageKey: null,
        description: null,
      });

      const res = await service.updateItem(managerId, 'item-1', {
        name: '   ',
        size: null as unknown as UpdateItemReq['size'],
        description: '',
        imageKey: '',
      });

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          size: null,
          description: null,
          imageKey: null,
        },
      });
      expect(res.item.costPrice).toBe(0);
      expect(res.item.createdAt).toBeUndefined();

      prisma.item.update.mockResolvedValueOnce({
        id: 'item-1',
        branchId,
        name: 'Old Name',
        category: ItemCategory.OTHER,
        size: null,
        price: 10000,
        costPrice: 0,
        stockQuantity: 0,
        lowStockThreshold: 10,
        status: ItemStatus.OUT_OF_STOCK,
        imageKey: 'req-key.png',
        description: null,
      });
      const res2 = await service.updateItem(managerId, 'item-1', {
        imageKey: 'req-key.png',
      });
      expect(res2.item.imageKey).toBe('req-key.png');

      prisma.item.update.mockResolvedValueOnce({
        id: 'item-1',
        branchId,
        name: 'Old Name',
        category: ItemCategory.OTHER,
        size: null,
        price: 12000,
        costPrice: 0,
        stockQuantity: 0,
        lowStockThreshold: 10,
        status: ItemStatus.OUT_OF_STOCK,
        imageKey: null,
        description: null,
      });
      const res3 = await service.updateItem(managerId, 'item-1', {
        price: 12000,
      });
      expect(res3.item.price).toBe(12000);
    });
  });

  describe('queryBranchItems', () => {
    it('queries DB-paginated items with category, status, and search filters', async () => {
      mockValidManagerBranch();
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          branchId,
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          size: null,
          price: 50000,
          costPrice: null,
          stockQuantity: 3,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
          imageKey: null,
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      prisma.item.count.mockResolvedValue(1);

      const page = await service.queryBranchItems(
        managerId,
        Object.assign(new QueryBranchItemsReq(), {
          category:
            ItemCategory.POPCORN as unknown as QueryBranchItemsReq['category'],
          status:
            ItemStatus.AVAILABLE as unknown as QueryBranchItemsReq['status'],
          search: '  Bắp ',
          page: 2,
          limit: 5,
        }),
      );

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: {
          branchId,
          category: ItemCategory.POPCORN,
          status: ItemStatus.AVAILABLE,
          name: { contains: 'Bắp', mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(prisma.item.count).toHaveBeenCalled();
      expect(page.total).toBe(1);
      expect(page.items[0].isLowStock).toBe(true);
    });

    it('filters and slices in-memory when lowStockOnly is true', async () => {
      mockValidManagerBranch();
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'i-1',
          branchId,
          name: 'Low 1',
          category: ItemCategory.POPCORN,
          price: 1000,
          stockQuantity: 2,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
        },
        {
          id: 'i-2',
          branchId,
          name: 'Inactive Low',
          category: ItemCategory.POPCORN,
          price: 1000,
          stockQuantity: 1,
          lowStockThreshold: 5,
          status: ItemStatus.INACTIVE,
        },
        {
          id: 'i-3',
          branchId,
          name: 'Healthy',
          category: ItemCategory.POPCORN,
          price: 1000,
          stockQuantity: 50,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
        },
        {
          id: 'i-4',
          branchId,
          name: 'Low 2',
          category: ItemCategory.SNACK,
          price: 1000,
          stockQuantity: 5,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
        },
      ]);

      const page = await service.queryBranchItems(
        managerId,
        Object.assign(new QueryBranchItemsReq(), {
          lowStockOnly: true,
          search: '   ',
          page: 0,
          limit: 1,
        }),
      );

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        skip: undefined,
        take: undefined,
      });
      expect(prisma.item.count).not.toHaveBeenCalled();
      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(1);
      expect(page.items[0].itemId).toBe('i-1');

      prisma.item.findMany.mockResolvedValueOnce([]);
      prisma.item.count.mockResolvedValueOnce(0);
      const defaultPage = await service.queryBranchItems(
        managerId,
        {} as unknown as QueryBranchItemsReq,
      );
      expect(defaultPage.page).toBe(1);
      expect(defaultPage.limit).toBe(10);
    });
  });

  describe('getItemDetail', () => {
    it('throws NotFoundException when item not found', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.getItemDetail(managerId, 'item-404'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns mapped ItemRes when item exists', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        branchId,
        name: 'Coca',
        category: ItemCategory.BEVERAGE,
        size: ItemSize.MEDIUM,
        price: 30000,
        costPrice: 10000,
        stockQuantity: 20,
        lowStockThreshold: 5,
        status: ItemStatus.AVAILABLE,
        imageKey: 'coca.png',
        description: 'Nước ngọt',
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.getItemDetail(managerId, 'item-1');
      expect(res.itemId).toBe('item-1');
      expect(res.isLowStock).toBe(false);
      expect(res.createdAt).toBe(now.toISOString());

      prisma.item.findFirst.mockResolvedValueOnce({
        id: 'item-2',
        branchId,
        name: 'Snack',
        category: ItemCategory.SNACK,
        size: null,
        price: 15000,
        costPrice: null,
        stockQuantity: 0,
        lowStockThreshold: 5,
        status: ItemStatus.OUT_OF_STOCK,
        imageKey: null,
        description: null,
      });
      const res2 = await service.getItemDetail(managerId, 'item-2');
      expect(res2.costPrice).toBe(0);
      expect(res2.createdAt).toBeUndefined();
    });
  });

  describe('adjustItemStock', () => {
    it('throws NotFoundException when item not found', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.adjustItemStock(managerId, 'item-404', {
          adjustmentType: StockAdjustmentType.ADD,
          quantity: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('handles ADD, SET, SUBTRACT and updates status accordingly', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        stockQuantity: 0,
        status: ItemStatus.OUT_OF_STOCK,
      });
      prisma.item.update.mockResolvedValue({});

      const addRes = await service.adjustItemStock(managerId, 'item-1', {
        adjustmentType: StockAdjustmentType.ADD,
        quantity: 10,
      });
      expect(addRes.previousStock).toBe(0);
      expect(addRes.currentStock).toBe(10);
      expect(addRes.status).toBe(ItemStatus.AVAILABLE);

      prisma.item.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        stockQuantity: 10,
        status: ItemStatus.AVAILABLE,
      });
      const setRes = await service.adjustItemStock(managerId, 'item-1', {
        adjustmentType: StockAdjustmentType.SET,
        quantity: 0,
      });
      expect(setRes.currentStock).toBe(0);
      expect(setRes.status).toBe(ItemStatus.OUT_OF_STOCK);

      prisma.item.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        stockQuantity: 10,
        status: ItemStatus.AVAILABLE,
      });
      const subRes = await service.adjustItemStock(managerId, 'item-1', {
        adjustmentType: StockAdjustmentType.SUBTRACT,
        quantity: 4,
      });
      expect(subRes.currentStock).toBe(6);
    });

    it('throws BadRequestException when SUBTRACT results in negative stock or adjustmentType is invalid', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        stockQuantity: 3,
        status: ItemStatus.AVAILABLE,
      });

      await expect(
        service.adjustItemStock(managerId, 'item-1', {
          adjustmentType: StockAdjustmentType.SUBTRACT,
          quantity: 5,
        }),
      ).rejects.toThrow(
        new BadRequestException(CONCESSION_MESSAGES.STOCK_CANNOT_BE_NEGATIVE),
      );

      await expect(
        service.adjustItemStock(managerId, 'item-1', {
          adjustmentType: 'UNKNOWN' as unknown as StockAdjustmentType,
          quantity: 1,
        }),
      ).rejects.toThrow(
        new BadRequestException(CONCESSION_MESSAGES.INVALID_STOCK_ADJUSTMENT),
      );
    });
  });

  describe('changeItemStatus', () => {
    it('throws NotFoundException when item not found', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.changeItemStatus(managerId, 'item-404', {
          status:
            ItemStatus.INACTIVE as unknown as ChangeItemStatusReq['status'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves status and updates item', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        stockQuantity: 5,
        status: ItemStatus.AVAILABLE,
      });
      prisma.item.update.mockResolvedValue({
        id: 'item-1',
        branchId,
        name: 'Bắp',
        category: ItemCategory.POPCORN,
        size: null,
        price: 50000,
        costPrice: null,
        stockQuantity: 5,
        lowStockThreshold: 10,
        status: ItemStatus.INACTIVE,
        imageKey: null,
        description: null,
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.changeItemStatus(managerId, 'item-1', {
        status: ItemStatus.INACTIVE as unknown as ChangeItemStatusReq['status'],
      });

      expect(res.message).toBe(CONCESSION_MESSAGES.STATUS_UPDATE_SUCCESS);
      expect(res.item.status).toBe(ItemStatus.INACTIVE);
      expect(res.item.isLowStock).toBe(false);

      prisma.item.update.mockResolvedValueOnce({
        id: 'item-1',
        branchId,
        name: 'Bắp',
        category: ItemCategory.POPCORN,
        size: null,
        price: 50000,
        costPrice: 10000,
        stockQuantity: 5,
        lowStockThreshold: 10,
        status: ItemStatus.AVAILABLE,
        imageKey: null,
        description: null,
      });
      const res2 = await service.changeItemStatus(managerId, 'item-1', {
        status:
          ItemStatus.AVAILABLE as unknown as ChangeItemStatusReq['status'],
      });
      expect(res2.item.createdAt).toBeUndefined();
    });
  });

  describe('deleteItem', () => {
    it('throws NotFoundException when item not found', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(service.deleteItem(managerId, 'item-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes item and returns DeleteMutationRes', async () => {
      mockValidManagerBranch();
      prisma.item.findFirst.mockResolvedValue({ id: 'item-1', branchId });
      prisma.item.delete.mockResolvedValue({});

      const res = await service.deleteItem(managerId, 'item-1');

      expect(prisma.item.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
      expect(res).toEqual({
        message: CONCESSION_MESSAGES.DELETE_SUCCESS,
        id: 'item-1',
      });
    });
  });

  describe('getItemExcelTemplate', () => {
    it('generates a readable Excel template buffer with headers and sample row', async () => {
      const buffer = await service.getItemExcelTemplate();
      expect(Buffer.isBuffer(buffer)).toBe(true);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(
        buffer as unknown as Parameters<typeof wb.xlsx.load>[0],
      );
      const sheet = wb.worksheets[0];
      expect(sheet.name).toBe('Danh sách món ăn & nước uống');
      expect(sheet.getRow(1).getCell(1).text).toBe('Tên món (*)');
      expect(sheet.getRow(2).getCell(1).text).toBe('Bắp rang bơ phô mai');
      expect(sheet.getRow(2).getCell(4).value).toBe(65000);
    });
  });

  describe('importItemsExcel', () => {
    const buildWorkbookBuffer = async (rows: unknown[][]): Promise<Buffer> => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Items');
      for (const r of rows) {
        ws.addRow(r);
      }
      return Buffer.from(await wb.xlsx.writeBuffer());
    };

    it('throws BadRequestException when buffer is empty', async () => {
      mockValidManagerBranch();
      await expect(
        service.importItemsExcel(managerId, Buffer.alloc(0)),
      ).rejects.toThrow(
        new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY),
      );
    });

    it('throws BadRequestException when workbook has no worksheet', async () => {
      mockValidManagerBranch();
      const wb = new ExcelJS.Workbook();
      const emptyBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      await expect(
        service.importItemsExcel(managerId, emptyBuffer),
      ).rejects.toThrow(
        new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY),
      );
    });

    it('throws BadRequestException when worksheet has only header row', async () => {
      mockValidManagerBranch();
      const buf = await buildWorkbookBuffer([['Tên món', 'Danh mục']]);

      await expect(service.importItemsExcel(managerId, buf)).rejects.toThrow(
        new BadRequestException(CONCESSION_MESSAGES.EXCEL_FILE_EMPTY),
      );
    });

    it('imports valid rows (create & update with OVERWRITE/ACCUMULATE), skips blank rows, and records row errors', async () => {
      mockValidManagerBranch();

      const buf = await buildWorkbookBuffer([
        [
          'Tên món',
          'Danh mục',
          'Kích cỡ',
          'Giá bán',
          'Giá nhập',
          'Tồn kho',
          'Ngưỡng',
          'Mô tả',
        ],
        [null, null, null, null, null, null, null, null],
        ['', 'POPCORN', '', 50000, 10000, 10, 5, ''],
        ['Món sai cat', 'INVALID_CAT', '', 50000, 10000, 10, 5, ''],
        ['Món sai giá', 'POPCORN', '', 0, 10000, 10, 5, ''],
        ['Món sai stock', 'POPCORN', '', 50000, 10000, 1.5, 5, ''],
        ['Bắp mới', 'POPCORN', 'LARGE', 65000, 20000, 15, 5, 'Giòn'],
        ['Nước cũ', 'BEVERAGE', '', 30000, -1, 10, -1, ''],
      ]);

      prisma.item.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'item-old',
        stockQuantity: 25,
        status: ItemStatus.AVAILABLE,
      });
      prisma.item.create.mockResolvedValue({});
      prisma.item.update.mockResolvedValue({});

      const res = await service.importItemsExcel(managerId, buf, {
        stockMode: ExcelStockMode.ACCUMULATE,
      });

      expect(res.totalRows).toBe(6);
      expect(res.successCount).toBe(2);
      expect(res.errorCount).toBe(4);
      expect(res.createdCount).toBe(1);
      expect(res.updatedCount).toBe(1);
      expect(res.errors.map((e) => e.reason)).toEqual([
        CONCESSION_MESSAGES.ITEM_NAME_REQUIRED,
        CONCESSION_MESSAGES.INVALID_CATEGORY,
        CONCESSION_MESSAGES.PRICE_POSITIVE,
        CONCESSION_MESSAGES.STOCK_POSITIVE_INT,
      ]);

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          branchId,
          name: 'Bắp mới',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 65000,
          costPrice: 20000,
          stockQuantity: 15,
          lowStockThreshold: 5,
          status: ItemStatus.AVAILABLE,
          description: 'Giòn',
        },
      });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-old' },
        data: {
          category: ItemCategory.BEVERAGE,
          size: undefined,
          price: 30000,
          costPrice: 0,
          lowStockThreshold: 10,
          description: undefined,
          stockQuantity: 35,
          status: ItemStatus.AVAILABLE,
        },
      });
    });

    it('overwrites stock by default when stockMode omitted and updates size/description when provided', async () => {
      mockValidManagerBranch();
      const buf = await buildWorkbookBuffer([
        [
          'Tên món',
          'Danh mục',
          'Kích cỡ',
          'Giá bán',
          'Giá nhập',
          'Tồn kho',
          'Ngưỡng',
          'Mô tả',
        ],
        ['Nước mới', 'BEVERAGE', 'M', 30000, null, 0, null, null],
        ['Nước cũ', 'BEVERAGE', 'L', 35000, 10000, 5, 2, 'Mát lạnh'],
      ]);

      prisma.item.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'item-old',
        stockQuantity: 20,
        status: ItemStatus.AVAILABLE,
      });
      prisma.item.create.mockResolvedValue({});
      prisma.item.update.mockResolvedValue({});

      const res = await service.importItemsExcel(managerId, buf);

      expect(res.createdCount).toBe(1);
      expect(res.updatedCount).toBe(1);
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          branchId,
          name: 'Nước mới',
          category: ItemCategory.BEVERAGE,
          size: ItemSize.MEDIUM,
          price: 30000,
          costPrice: 0,
          stockQuantity: 0,
          lowStockThreshold: 0,
          status: ItemStatus.OUT_OF_STOCK,
          description: null,
        },
      });
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-old' },
        data: {
          category: ItemCategory.BEVERAGE,
          size: ItemSize.LARGE,
          price: 35000,
          costPrice: 10000,
          lowStockThreshold: 2,
          description: 'Mát lạnh',
          stockQuantity: 5,
          status: ItemStatus.AVAILABLE,
        },
      });
    });
  });

  describe('getConcessionOptions', () => {
    it('returns branch metadata, enum options, and active items for combo', async () => {
      mockValidManagerBranch();
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 60000,
          stockQuantity: 10,
        },
        {
          id: 'item-2',
          name: 'Nước',
          category: ItemCategory.BEVERAGE,
          size: null,
          price: 30000,
          stockQuantity: 15,
        },
      ]);

      const res = await service.getConcessionOptions(managerId);

      expect(res.branch).toEqual({
        branchId,
        branchName: branchDoc.branchName,
        address: branchDoc.address,
      });
      expect(res.categories).toEqual(Object.values(ItemCategory));
      expect(res.sizes).toEqual(Object.values(ItemSize));
      expect(res.itemStatuses).toEqual(Object.values(ItemStatus));
      expect(res.comboStatuses).toEqual(Object.values(ComboStatus));
      expect(res.availableItemsForCombo).toEqual([
        {
          itemId: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 60000,
          stockQuantity: 10,
        },
        {
          itemId: 'item-2',
          name: 'Nước',
          category: ItemCategory.BEVERAGE,
          size: null,
          price: 30000,
          stockQuantity: 15,
        },
      ]);
    });
  });

  describe('getProductsByIds', () => {
    it('returns empty map when productIds is empty', async () => {
      const res = await service.getProductsByIds([]);
      expect(res.size).toBe(0);
      expect(prisma.item.findMany).not.toHaveBeenCalled();
    });

    it('resolves both items and combos and formats image URLs across env cases', async () => {
      const prevEnv = process.env.STORAGE_PUBLIC_URL;
      process.env.STORAGE_PUBLIC_URL = 'https://cdn.example.test/';

      try {
        prisma.item.findMany.mockResolvedValue([
          {
            id: 'item-1',
            name: 'Bắp',
            price: 50000,
            imageKey: '/items/pop.png',
            branchId,
          },
          {
            id: 'item-2',
            name: 'Nước',
            price: 25000,
            imageKey: 'https://img.example.test/coke.png',
            branchId,
          },
          {
            id: 'item-3',
            name: 'Kẹo',
            price: 15000,
            imageKey: '///',
            branchId,
          },
          {
            id: 'item-4',
            name: 'Bánh',
            price: 20000,
            imageKey: null,
            branchId,
          },
        ]);
        prisma.combo.findMany.mockResolvedValue([
          {
            id: 'combo-1',
            name: 'Combo 1',
            price: 70000,
            imageKey: 'combos/c1.png',
            branchId,
          },
          {
            id: 'combo-2',
            name: 'Combo 2',
            price: 80000,
            imageKey: '   ',
            branchId,
          },
        ]);

        const map = await service.getProductsByIds([
          'item-1',
          'item-2',
          'item-3',
          'item-4',
          'combo-1',
          'combo-2',
          'missing-id',
        ]);

        expect(map.get('item-1')?.imageUrl).toBe(
          'https://cdn.example.test/items/pop.png',
        );
        expect(map.get('item-2')?.imageUrl).toBe(
          'https://img.example.test/coke.png',
        );
        expect(map.get('item-3')?.imageUrl).toBeUndefined();
        expect(map.get('item-4')?.imageUrl).toBeUndefined();
        expect(map.get('combo-1')?.imageUrl).toBe(
          'https://cdn.example.test/combos/c1.png',
        );
        expect(map.get('combo-2')?.imageUrl).toBeUndefined();
        expect(map.has('missing-id')).toBe(false);

        delete process.env.STORAGE_PUBLIC_URL;
        prisma.item.findMany.mockResolvedValueOnce([
          {
            id: 'item-1',
            name: 'Bắp',
            price: 50000,
            imageKey: 'items/pop.png',
            branchId,
          },
        ]);
        const mapNoBase = await service.getProductsByIds(['item-1']);
        expect(mapNoBase.get('item-1')?.imageUrl).toBeUndefined();
        expect(prisma.combo.findMany).toHaveBeenCalledTimes(1);
      } finally {
        if (prevEnv === undefined) delete process.env.STORAGE_PUBLIC_URL;
        else process.env.STORAGE_PUBLIC_URL = prevEnv;
      }
    });
  });
});
