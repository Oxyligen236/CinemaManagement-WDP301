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
  Role,
} from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  ChangeComboStatusReq,
  CreateComboReq,
  QueryBranchCombosReq,
  UpdateComboReq,
} from '../dto/req.dto';
import { ComboService } from './combo.service';

describe('ComboService', () => {
  let service: ComboService;
  let prisma: {
    user: { findUnique: jest.Mock };
    branch: { findFirst: jest.Mock };
    combo: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    item: { findMany: jest.Mock };
  };

  const managerId = 'mgr-1';
  const branchId = 'branch-1';
  const now = new Date('2026-11-01T10:00:00Z');
  const emptyQuery = {} as unknown as QueryBranchCombosReq;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      branch: { findFirst: jest.fn() },
      combo: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      item: { findMany: jest.fn() },
    };
    service = new ComboService(prisma as unknown as PrismaService);
  });

  const mockActiveManagerAndBranch = (
    role: Role | 'BRANCHMANAGER' = Role.MANAGER,
  ) => {
    prisma.user.findUnique.mockResolvedValue({
      role,
      isActive: true,
      branchId,
    });
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
  };

  describe('resolveManagerBranchId (via public methods)', () => {
    it('throws ForbiddenException when manager does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.queryBranchCombos(managerId, emptyQuery),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is inactive or not a manager', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        role: Role.MANAGER,
        isActive: false,
        branchId,
      });
      await expect(
        service.queryBranchCombos(managerId, emptyQuery),
      ).rejects.toThrow(ForbiddenException);

      prisma.user.findUnique.mockResolvedValueOnce({
        role: Role.STAFF,
        isActive: true,
        branchId,
      });
      await expect(
        service.queryBranchCombos(managerId, emptyQuery),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when manager has no branchId or branch is inactive', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        role: Role.MANAGER,
        isActive: true,
        branchId: null,
      });
      await expect(
        service.queryBranchCombos(managerId, emptyQuery),
      ).rejects.toThrow(ForbiddenException);

      prisma.user.findUnique.mockResolvedValueOnce({
        role: 'BRANCHMANAGER',
        isActive: true,
        branchId,
      });
      prisma.branch.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.queryBranchCombos(managerId, emptyQuery),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createCombo', () => {
    const baseReq = {
      name: '  Combo Couple  ',
      price: 120000,
      description: '  Hai bắp hai nước  ',
      items: [
        { itemId: 'item-1', quantity: 1 },
        { itemId: 'item-2', quantity: 2 },
      ],
    } as CreateComboReq;

    it('throws ConflictException when combo name already exists in branch', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue({ id: 'combo-existing' });

      await expect(service.createCombo(managerId, baseReq)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException when items contain duplicate itemIds', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);

      await expect(
        service.createCombo(managerId, {
          ...baseReq,
          items: [
            { itemId: 'item-1', quantity: 1 },
            { itemId: 'item-1', quantity: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a component item does not exist in branch', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bắp', status: ItemStatus.AVAILABLE },
      ]);

      await expect(service.createCombo(managerId, baseReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when a component item is INACTIVE', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Bắp', status: ItemStatus.AVAILABLE },
        { id: 'item-2', name: 'Nước', status: ItemStatus.INACTIVE },
      ]);

      await expect(service.createCombo(managerId, baseReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates combo with explicit imageKey, calculates stock and savings', async () => {
      mockActiveManagerAndBranch('BRANCHMANAGER');
      prisma.combo.findFirst.mockResolvedValue(null);
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Bắp lớn',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 80000,
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
        },
        {
          id: 'item-2',
          name: 'Coca',
          category: ItemCategory.BEVERAGE,
          size: ItemSize.MEDIUM,
          price: 35000,
          stockQuantity: 11,
          status: ItemStatus.AVAILABLE,
        },
      ]);
      prisma.combo.create.mockResolvedValue({
        id: 'combo-1',
        branchId,
        name: 'Combo Couple',
        price: 120000,
        description: 'Hai bắp hai nước',
        imageKey: 'concessions/combo.png',
        status: ComboStatus.AVAILABLE,
        items: baseReq.items,
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.createCombo(
        managerId,
        baseReq,
        'concessions/combo.png',
      );

      expect(prisma.combo.create).toHaveBeenCalledWith({
        data: {
          branchId,
          name: 'Combo Couple',
          price: 120000,
          description: 'Hai bắp hai nước',
          imageKey: 'concessions/combo.png',
          status: ComboStatus.AVAILABLE,
          items: [
            { itemId: 'item-1', quantity: 1 },
            { itemId: 'item-2', quantity: 2 },
          ],
        },
      });
      expect(res.message).toBe('Tạo gói combo thành công');
      expect(res.combo.availableStock).toBe(5);
      expect(res.combo.originalTotalPrice).toBe(150000);
      expect(res.combo.savingsAmount).toBe(30000);
      expect(res.combo.isAvailable).toBe(true);
      expect(res.combo.createdAt).toBe(now.toISOString());
    });

    it('creates combo using fallback req.imageKey/status/description', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          size: null,
          price: 50000,
          stockQuantity: 3,
          status: ItemStatus.AVAILABLE,
        },
      ]);
      prisma.combo.create.mockResolvedValue({
        id: 'combo-2',
        branchId,
        name: 'Combo Mini',
        price: 60000,
        description: null,
        imageKey: 'req-img.png',
        status: ComboStatus.INACTIVE,
        items: [{ itemId: 'item-1', quantity: 1 }],
      });

      const res = await service.createCombo(managerId, {
        name: 'Combo Mini',
        price: 60000,
        status: ComboStatus.INACTIVE as unknown as CreateComboReq['status'],
        imageKey: 'req-img.png',
        items: [{ itemId: 'item-1', quantity: 1 }],
      });

      expect(res.combo.savingsAmount).toBe(0);
      expect(res.combo.isAvailable).toBe(false);
      expect(res.combo.createdAt).toBeUndefined();
      expect(res.combo.updatedAt).toBeUndefined();

      prisma.combo.create.mockResolvedValueOnce({
        id: 'combo-3',
        branchId,
        name: 'Combo No Img',
        price: 40000,
        status: ComboStatus.AVAILABLE,
        items: [{ itemId: 'item-1', quantity: 1 }],
      });
      const resNoImg = await service.createCombo(managerId, {
        name: 'Combo No Img',
        price: 40000,
        items: [{ itemId: 'item-1', quantity: 1 }],
      });
      expect(resNoImg.combo.imageKey).toBeNull();
      expect(resNoImg.combo.description).toBeNull();
    });
  });

  describe('updateCombo', () => {
    it('throws NotFoundException when combo does not exist', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCombo(managerId, 'combo-missing', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to a duplicate combo name', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst
        .mockResolvedValueOnce({ id: 'combo-1', branchId })
        .mockResolvedValueOnce({ id: 'combo-2', name: 'Existing' });

      await expect(
        service.updateCombo(managerId, 'combo-1', { name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates all fields including imageKey param and items', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst
        .mockResolvedValueOnce({ id: 'combo-1', branchId })
        .mockResolvedValueOnce(null);
      prisma.item.findMany
        .mockResolvedValueOnce([
          {
            id: 'item-1',
            name: 'Bắp',
            category: ItemCategory.POPCORN,
            price: 50000,
            stockQuantity: 8,
            status: ItemStatus.AVAILABLE,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'item-1',
            name: 'Bắp',
            category: ItemCategory.POPCORN,
            price: 50000,
            stockQuantity: 8,
            status: ItemStatus.AVAILABLE,
          },
        ]);
      prisma.combo.update.mockResolvedValue({
        id: 'combo-1',
        branchId,
        name: 'Combo Updated',
        price: 90000,
        description: 'Desc',
        imageKey: 'uploaded.png',
        status: ComboStatus.AVAILABLE,
        items: [{ itemId: 'item-1', quantity: 2 }],
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.updateCombo(
        managerId,
        'combo-1',
        {
          name: '  Combo Updated  ',
          price: 90000,
          description: '  Desc  ',
          status: ComboStatus.AVAILABLE as unknown as UpdateComboReq['status'],
          items: [{ itemId: 'item-1', quantity: 2 }],
        },
        'uploaded.png',
      );

      expect(prisma.combo.update).toHaveBeenCalledWith({
        where: { id: 'combo-1' },
        data: {
          name: 'Combo Updated',
          price: 90000,
          description: 'Desc',
          imageKey: 'uploaded.png',
          status: ComboStatus.AVAILABLE,
          items: [{ itemId: 'item-1', quantity: 2 }],
        },
      });
      expect(res.message).toBe('Cập nhật gói combo thành công');
      expect(res.combo.availableStock).toBe(4);
    });

    it('handles clearing description/imageKey and partial update without items', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue({ id: 'combo-1', branchId });
      prisma.combo.update.mockResolvedValue({
        id: 'combo-1',
        branchId,
        name: 'Combo',
        price: 50000,
        description: null,
        imageKey: null,
        status: ComboStatus.AVAILABLE,
        items: null,
      });

      const res = await service.updateCombo(managerId, 'combo-1', {
        description: '',
        imageKey: '',
      });

      expect(prisma.combo.update).toHaveBeenCalledWith({
        where: { id: 'combo-1' },
        data: {
          description: null,
          imageKey: null,
        },
      });
      expect(res.combo.availableStock).toBe(0);
      expect(res.combo.items).toEqual([]);

      prisma.combo.update.mockResolvedValueOnce({
        id: 'combo-1',
        branchId,
        name: 'Combo',
        price: 50000,
        imageKey: 'manual-key.png',
        status: ComboStatus.AVAILABLE,
        items: [
          { itemId: 'deleted-item', quantity: 0 },
          { itemId: 'item-rich', quantity: 1 },
        ],
      });
      prisma.item.findMany.mockResolvedValueOnce([
        {
          id: 'item-rich',
          name: 'Nước',
          category: ItemCategory.BEVERAGE,
          price: 30000,
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
        },
      ]);
      const res2 = await service.updateCombo(managerId, 'combo-1', {
        imageKey: 'manual-key.png',
      });
      expect(res2.combo.items[0].name).toBe('Món đã bị xoá');
      expect(res2.combo.availableStock).toBe(0);

      prisma.combo.update.mockResolvedValueOnce({
        id: 'combo-1',
        branchId,
        name: 'Combo',
        price: 55000,
        imageKey: 'manual-key.png',
        status: ComboStatus.AVAILABLE,
        items: [],
      });
      const res3 = await service.updateCombo(managerId, 'combo-1', {
        price: 55000,
      });
      expect(res3.combo.price).toBe(55000);
    });
  });

  describe('queryBranchCombos', () => {
    it('queries with default pagination and empty filters', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.count.mockResolvedValue(1);
      prisma.combo.findMany.mockResolvedValue([
        {
          id: 'combo-1',
          branchId,
          name: 'Combo 1',
          price: 100000,
          status: ComboStatus.AVAILABLE,
          items: null,
        },
      ]);

      const page = await service.queryBranchCombos(managerId, {
        search: '   ',
      } as unknown as QueryBranchCombosReq);

      expect(prisma.combo.count).toHaveBeenCalledWith({ where: { branchId } });
      expect(prisma.combo.findMany).toHaveBeenCalledWith({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(page.total).toBe(1);
      expect(page.items).toHaveLength(1);
    });

    it('applies status, search, custom page/limit and maps items', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.count.mockResolvedValue(1);
      prisma.combo.findMany.mockResolvedValue([
        {
          id: 'combo-1',
          branchId,
          name: 'Combo VIP',
          price: 100000,
          status: ComboStatus.AVAILABLE,
          items: [{ itemId: 'item-1', quantity: 1 }],
        },
      ]);
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          size: ItemSize.LARGE,
          price: 60000,
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
        },
      ]);

      const page = await service.queryBranchCombos(managerId, {
        status:
          ComboStatus.AVAILABLE as unknown as QueryBranchCombosReq['status'],
        search: '  VIP ',
        page: 2,
        limit: 5,
      });

      expect(prisma.combo.count).toHaveBeenCalledWith({
        where: {
          branchId,
          status: ComboStatus.AVAILABLE,
          name: { contains: 'VIP', mode: 'insensitive' },
        },
      });
      expect(prisma.combo.findMany).toHaveBeenCalledWith({
        where: {
          branchId,
          status: ComboStatus.AVAILABLE,
          name: { contains: 'VIP', mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(page.page).toBe(2);
      expect(page.limit).toBe(5);
      expect(page.items[0].items[0].isItemAvailable).toBe(true);
    });
  });

  describe('getComboDetail', () => {
    it('throws NotFoundException when combo not found', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);

      await expect(service.getComboDetail(managerId, 'c-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns mapped combo detail', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue({
        id: 'c-1',
        branchId,
        name: 'Combo 1',
        price: 70000,
        status: ComboStatus.AVAILABLE,
        items: [{ itemId: 'item-1', quantity: 1 }],
      });
      prisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          price: 50000,
          stockQuantity: 4,
          status: ItemStatus.AVAILABLE,
        },
      ]);

      const detail = await service.getComboDetail(managerId, 'c-1');
      expect(detail.comboId).toBe('c-1');
      expect(detail.availableStock).toBe(4);

      prisma.combo.findFirst.mockResolvedValueOnce({
        id: 'c-2',
        branchId,
        name: 'Empty',
        price: 70000,
        status: ComboStatus.AVAILABLE,
        items: null,
      });
      const detail2 = await service.getComboDetail(managerId, 'c-2');
      expect(detail2.items).toEqual([]);
    });
  });

  describe('changeComboStatus', () => {
    it('throws NotFoundException when combo not found', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);

      await expect(
        service.changeComboStatus(managerId, 'c-1', {
          status:
            ComboStatus.INACTIVE as unknown as ChangeComboStatusReq['status'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates combo status and returns ComboMutationRes', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue({ id: 'c-1', branchId });
      prisma.combo.update.mockResolvedValue({
        id: 'c-1',
        branchId,
        name: 'Combo 1',
        price: 70000,
        status: ComboStatus.INACTIVE,
        items: null,
      });

      const res = await service.changeComboStatus(managerId, 'c-1', {
        status:
          ComboStatus.INACTIVE as unknown as ChangeComboStatusReq['status'],
      });

      expect(res.message).toBe('Cập nhật trạng thái combo thành công');
      expect(res.combo.status).toBe(ComboStatus.INACTIVE);
      expect(res.combo.isAvailable).toBe(false);

      prisma.combo.update.mockResolvedValueOnce({
        id: 'c-1',
        branchId,
        name: 'Combo 1',
        price: 70000,
        status: ComboStatus.AVAILABLE,
        items: [{ itemId: 'item-1', quantity: 1 }],
      });
      prisma.item.findMany.mockResolvedValueOnce([
        {
          id: 'item-1',
          name: 'Bắp',
          category: ItemCategory.POPCORN,
          price: 50000,
          stockQuantity: 4,
          status: ItemStatus.AVAILABLE,
        },
      ]);
      const res2 = await service.changeComboStatus(managerId, 'c-1', {
        status:
          ComboStatus.AVAILABLE as unknown as ChangeComboStatusReq['status'],
      });
      expect(res2.combo.isAvailable).toBe(true);
    });
  });

  describe('deleteCombo', () => {
    it('throws NotFoundException when combo not found', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue(null);

      await expect(service.deleteCombo(managerId, 'c-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes combo and returns DeleteMutationRes', async () => {
      mockActiveManagerAndBranch();
      prisma.combo.findFirst.mockResolvedValue({ id: 'c-1', branchId });
      prisma.combo.delete.mockResolvedValue({});

      const res = await service.deleteCombo(managerId, 'c-1');

      expect(prisma.combo.delete).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
      expect(res).toEqual({
        message: 'Xóa gói combo thành công',
        id: 'c-1',
      });
    });
  });
});
