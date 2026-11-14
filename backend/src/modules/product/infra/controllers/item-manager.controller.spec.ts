import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { Page } from '../../../../common/dto/page.dto';
import { AuthenticatedRequest } from '../../../auth/domain/auth-user';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { PresignedDowloadResponse } from '../../../infra/storage/dtos/dto';
import { StorageInterceptor } from '../../../infra/storage/infrastructure/interceptors/storage.interceptor';
import { Role } from '../../../user/domain/enums/role.enum';
import {
  CreateItemReq,
  QueryBranchItemsReq,
  UpdateItemReq,
} from '../../application/dto/req.dto';
import {
  ConcessionOptionsRes,
  DeleteMutationRes,
  ImportItemsExcelRes,
  ItemMutationRes,
  ItemRes,
  StockAdjustmentRes,
} from '../../application/dto/res.dto';
import { ItemService } from '../../application/services/item.service';
import { ExcelStockMode } from '../../domain/enums/excel-stock-mode.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { StockAdjustmentType } from '../../domain/enums/stock-adjustment-type.enum';
import { ItemManagerController } from './item-manager.controller';

describe('ItemManagerController', () => {
  let controller: ItemManagerController;
  let itemService: jest.Mocked<
    Pick<
      ItemService,
      | 'getConcessionOptions'
      | 'getItemExcelTemplate'
      | 'importItemsExcel'
      | 'queryBranchItems'
      | 'getItemDetail'
      | 'createItem'
      | 'updateItem'
      | 'adjustItemStock'
      | 'changeItemStatus'
      | 'deleteItem'
    >
  >;

  const mockReq = {
    user: {
      sub: 'mgr-1',
      email: 'mgr@example.com',
      role: Role.BRANCHMANAGER,
      tokenVersion: 0,
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    itemService = {
      getConcessionOptions: jest.fn(),
      getItemExcelTemplate: jest.fn(),
      importItemsExcel: jest.fn(),
      queryBranchItems: jest.fn(),
      getItemDetail: jest.fn(),
      createItem: jest.fn(),
      updateItem: jest.fn(),
      adjustItemStock: jest.fn(),
      changeItemStatus: jest.fn(),
      deleteItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemManagerController],
      providers: [{ provide: ItemService, useValue: itemService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(StorageInterceptor)
      .useValue({
        intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle(),
      })
      .compile();

    controller = module.get<ItemManagerController>(ItemManagerController);
  });

  it('getOptions delegates to itemService.getConcessionOptions', async () => {
    const expected = { categories: [] } as unknown as ConcessionOptionsRes;
    itemService.getConcessionOptions.mockResolvedValue(expected);

    const res = await controller.getOptions(mockReq);
    expect(itemService.getConcessionOptions).toHaveBeenCalledWith('mgr-1');
    expect(res).toBe(expected);
  });

  it('getExcelTemplate sets xlsx headers and sends buffer', async () => {
    const buffer = Buffer.from('excel-content');
    itemService.getItemExcelTemplate.mockResolvedValue(buffer);
    const setHeader = jest.fn();
    const send = jest.fn();
    const mockRes = { setHeader, send } as unknown as Response;

    await controller.getExcelTemplate(mockRes);

    expect(itemService.getItemExcelTemplate).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="concession-item-template.xlsx"',
    );
    expect(send).toHaveBeenCalledWith(buffer);
  });

  it('importExcel passes file.buffer and body to itemService.importItemsExcel', async () => {
    const buffer = Buffer.from('xlsx');
    const body = { stockMode: ExcelStockMode.ACCUMULATE };
    const expected = { successCount: 1 } as ImportItemsExcelRes;
    itemService.importItemsExcel.mockResolvedValue(expected);

    const res = await controller.importExcel(
      mockReq,
      { buffer } as Express.Multer.File,
      body,
    );
    expect(itemService.importItemsExcel).toHaveBeenCalledWith(
      'mgr-1',
      buffer,
      body,
    );
    expect(res).toBe(expected);

    await controller.importExcel(
      mockReq,
      undefined as unknown as Express.Multer.File,
      body,
    );
    expect(itemService.importItemsExcel).toHaveBeenCalledWith(
      'mgr-1',
      undefined,
      body,
    );
  });

  it('queryItems delegates to itemService.queryBranchItems', async () => {
    const query = Object.assign(new QueryBranchItemsReq(), {
      page: 1,
      limit: 10,
    });
    const expected = Page.from<ItemRes>([], 0, 1, 10);
    itemService.queryBranchItems.mockResolvedValue(expected);

    const res = await controller.queryItems(mockReq, query);
    expect(itemService.queryBranchItems).toHaveBeenCalledWith('mgr-1', query);
    expect(res).toBe(expected);
  });

  it('getItemDetail delegates to itemService.getItemDetail', async () => {
    const expected = { itemId: 'item-1' } as ItemRes;
    itemService.getItemDetail.mockResolvedValue(expected);

    const res = await controller.getItemDetail(mockReq, 'item-1');
    expect(itemService.getItemDetail).toHaveBeenCalledWith('mgr-1', 'item-1');
    expect(res).toBe(expected);
  });

  it('createItem passes file.key when provided and undefined otherwise', async () => {
    const body = { name: 'Popcorn', price: 50000 } as CreateItemReq;
    const expected = { message: 'OK' } as ItemMutationRes;
    itemService.createItem.mockResolvedValue(expected);

    const res = await controller.createItem(mockReq, body, {
      key: 'concessions/item.png',
    } as PresignedDowloadResponse);
    expect(itemService.createItem).toHaveBeenCalledWith(
      'mgr-1',
      body,
      'concessions/item.png',
    );
    expect(res).toBe(expected);

    await controller.createItem(mockReq, body, undefined);
    expect(itemService.createItem).toHaveBeenCalledWith(
      'mgr-1',
      body,
      undefined,
    );
  });

  it('updateItem passes file.key when provided and undefined otherwise', async () => {
    const body = { price: 55000 } as UpdateItemReq;
    const expected = { message: 'Updated' } as ItemMutationRes;
    itemService.updateItem.mockResolvedValue(expected);

    const res = await controller.updateItem(mockReq, 'item-1', body, {
      key: 'concessions/u.png',
    } as PresignedDowloadResponse);
    expect(itemService.updateItem).toHaveBeenCalledWith(
      'mgr-1',
      'item-1',
      body,
      'concessions/u.png',
    );
    expect(res).toBe(expected);

    await controller.updateItem(mockReq, 'item-1', body, undefined);
    expect(itemService.updateItem).toHaveBeenCalledWith(
      'mgr-1',
      'item-1',
      body,
      undefined,
    );
  });

  it('adjustStock delegates to itemService.adjustItemStock', async () => {
    const body = {
      adjustmentType: StockAdjustmentType.ADD,
      quantity: 5,
    };
    const expected = { currentStock: 15 } as StockAdjustmentRes;
    itemService.adjustItemStock.mockResolvedValue(expected);

    const res = await controller.adjustStock(mockReq, 'item-1', body);
    expect(itemService.adjustItemStock).toHaveBeenCalledWith(
      'mgr-1',
      'item-1',
      body,
    );
    expect(res).toBe(expected);
  });

  it('changeStatus delegates to itemService.changeItemStatus', async () => {
    const body = { status: ItemStatus.INACTIVE };
    const expected = { message: 'Updated' } as ItemMutationRes;
    itemService.changeItemStatus.mockResolvedValue(expected);

    const res = await controller.changeStatus(mockReq, 'item-1', body);
    expect(itemService.changeItemStatus).toHaveBeenCalledWith(
      'mgr-1',
      'item-1',
      body,
    );
    expect(res).toBe(expected);
  });

  it('deleteItem delegates to itemService.deleteItem', async () => {
    const expected: DeleteMutationRes = { message: 'Deleted', id: 'item-1' };
    itemService.deleteItem.mockResolvedValue(expected);

    const res = await controller.deleteItem(mockReq, 'item-1');
    expect(itemService.deleteItem).toHaveBeenCalledWith('mgr-1', 'item-1');
    expect(res).toBe(expected);
  });
});
