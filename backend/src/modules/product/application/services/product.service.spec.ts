import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import {
  BranchStatus,
  ItemStatus,
  ComboStatus,
  ItemCategory,
} from '@prisma/client';
import { ItemService } from './item.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('ProductService', () => {
  let service: ProductService;
  let mockPrisma: any;
  let mockItemService: {
    getProductsByIds: jest.Mock;
  };

  beforeEach(() => {
    mockPrisma = {
      branch: {
        findFirst: jest.fn(),
      },
      item: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      combo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    mockItemService = {
      getProductsByIds: jest.fn(),
    };

    service = new ProductService(
      mockPrisma,
      mockItemService as unknown as ItemService,
    );
  });

  describe('getBranchConcessions', () => {
    it('ném NotFoundException khi chi nhánh không tồn tại hoặc ngưng hoạt động', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.getBranchConcessions('BRANCH-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về danh mục concessions của chi nhánh bao gồm items và combo tính tồn kho khả dụng', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: 'BRANCH-1',
        branchName: 'Chi nhánh Hà Nội',
        branchStatus: BranchStatus.ACTIVE,
      });

      const mockItems = [
        {
          id: 'ITEM-POPCORN',
          branchId: 'BRANCH-1',
          name: 'Bắp rang bơ',
          category: ItemCategory.POPCORN,
          price: 50000,
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
          imageKey: null,
        },
        {
          id: 'ITEM-COKE',
          branchId: 'BRANCH-1',
          name: 'Coca Cola',
          category: ItemCategory.BEVERAGE,
          price: 30000,
          stockQuantity: 20,
          status: ItemStatus.AVAILABLE,
          imageKey: null,
        },
      ];

      const mockCombos = [
        {
          id: 'COMBO-1',
          branchId: 'BRANCH-1',
          name: 'Combo Solo',
          price: 70000,
          status: ComboStatus.AVAILABLE,
          items: [
            { itemId: 'ITEM-POPCORN', quantity: 1 },
            { itemId: 'ITEM-COKE', quantity: 2 },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.combo.findMany.mockResolvedValue(mockCombos);

      const result = await service.getBranchConcessions('BRANCH-1');

      expect(result.branchId).toBe('BRANCH-1');
      expect(result.items).toHaveLength(2);
      expect(result.combos).toHaveLength(1);
      // min(10/1, 20/2) = min(10, 10) = 10
      expect(result.combos[0].availableStock).toBe(10);
    });

    it('trả imageUrl tuyệt đối, chuẩn hóa key có slash và bỏ raw key khi thiếu base URL', async () => {
      const previousPublicUrl = process.env.STORAGE_PUBLIC_URL;
      process.env.STORAGE_PUBLIC_URL = 'https://cdn.example.test/';
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: 'BRANCH-1',
        branchStatus: BranchStatus.ACTIVE,
      });
      const items = [
        {
          id: 'ITEM-1',
          name: 'Item',
          category: ItemCategory.POPCORN,
          price: 1,
          stockQuantity: 2,
          status: ItemStatus.AVAILABLE,
          imageKey: '/items/item.png',
        },
        {
          id: 'ITEM-2',
          name: 'Item absolute',
          category: ItemCategory.POPCORN,
          price: 1,
          stockQuantity: 2,
          status: ItemStatus.AVAILABLE,
          imageKey: 'https://images.example.test/item.png',
        },
      ];
      mockPrisma.item.findMany.mockResolvedValue(items);
      mockPrisma.combo.findMany.mockResolvedValue([]);

      try {
        const result = await service.getBranchConcessions('BRANCH-1');
        expect(result.items.map((item) => item.imageUrl)).toEqual([
          'https://cdn.example.test/items/item.png',
          'https://images.example.test/item.png',
        ]);
        delete process.env.STORAGE_PUBLIC_URL;
        const unsetImageUrlResult =
          await service.getBranchConcessions('BRANCH-1');
        expect(unsetImageUrlResult.items.map((item) => item.imageUrl)).toEqual([
          null,
          'https://images.example.test/item.png',
        ]);
      } finally {
        if (previousPublicUrl === undefined)
          delete process.env.STORAGE_PUBLIC_URL;
        else process.env.STORAGE_PUBLIC_URL = previousPublicUrl;
      }
    });

    it('bỏ qua combo nếu có món con không đủ tồn kho hoặc không khả dụng', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: 'BRANCH-1',
        branchStatus: BranchStatus.ACTIVE,
      });

      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.combo.findMany.mockResolvedValue([
        {
          id: 'COMBO-EMPTY',
          name: 'Combo Empty',
          price: 80000,
          status: ComboStatus.AVAILABLE,
          items: [{ itemId: 'ITEM-POPCORN', quantity: 1 }],
        },
      ]);

      const result = await service.getBranchConcessions('BRANCH-1');
      expect(result.combos).toHaveLength(0);
    });
  });

  describe('deductConcessionStock', () => {
    it('không thực hiện gì khi danh sách sản phẩm rỗng', async () => {
      await service.deductConcessionStock([]);
      expect(mockPrisma.item.findUnique).not.toHaveBeenCalled();
    });

    it('khấu trừ tồn kho cho món lẻ thành công', async () => {
      mockPrisma.item.findUnique
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 5,
          status: ItemStatus.AVAILABLE,
        })
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 5,
          status: ItemStatus.AVAILABLE,
        });

      mockPrisma.item.update.mockResolvedValue({});

      await service.deductConcessionStock([
        { productId: 'ITEM-1', quantity: 2 },
      ]);

      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: 'ITEM-1' },
        data: { stockQuantity: 3 },
      });
    });

    it('chuyển trạng thái OUT_OF_STOCK khi tồn kho về 0', async () => {
      mockPrisma.item.findUnique
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 2,
          status: ItemStatus.AVAILABLE,
        })
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 2,
          status: ItemStatus.AVAILABLE,
        });

      mockPrisma.item.update.mockResolvedValue({});

      await service.deductConcessionStock([
        { productId: 'ITEM-1', quantity: 2 },
      ]);

      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: 'ITEM-1' },
        data: {
          stockQuantity: 0,
          status: ItemStatus.OUT_OF_STOCK,
        },
      });
    });

    it('khấu trừ tồn kho từ combo nhân với số lượng từng món con', async () => {
      mockPrisma.item.findUnique
        .mockResolvedValueOnce(null) // ITEM not found -> check combo
        .mockResolvedValueOnce({
          id: 'ITEM-POPCORN',
          name: 'Bắp',
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
        })
        .mockResolvedValueOnce({
          id: 'ITEM-COKE',
          name: 'Nước',
          stockQuantity: 5,
          status: ItemStatus.AVAILABLE,
        });

      mockPrisma.combo.findUnique.mockResolvedValue({
        id: 'COMBO-1',
        items: [
          { itemId: 'ITEM-POPCORN', quantity: 2 },
          { itemId: 'ITEM-COKE', quantity: 1 },
        ],
      });

      mockPrisma.item.update.mockResolvedValue({});

      // Mua 2 combo: ITEM-POPCORN cần trừ 2*2=4, ITEM-COKE cần trừ 1*2=2
      await service.deductConcessionStock([
        { productId: 'COMBO-1', quantity: 2 },
      ]);

      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: 'ITEM-POPCORN' },
        data: { stockQuantity: 6 },
      });
      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: 'ITEM-COKE' },
        data: { stockQuantity: 3 },
      });
    });

    it('ném NotFoundException khi không tìm thấy mã sản phẩm', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(null);
      mockPrisma.combo.findUnique.mockResolvedValue(null);

      await expect(
        service.deductConcessionStock([
          { productId: 'UNKNOWN-ID', quantity: 1 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném ConflictException khi sản phẩm không đủ tồn kho', async () => {
      mockPrisma.item.findUnique
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 1,
          status: ItemStatus.AVAILABLE,
        })
        .mockResolvedValueOnce({
          id: 'ITEM-1',
          name: 'Bắp rang',
          stockQuantity: 1,
          status: ItemStatus.AVAILABLE,
        });

      await expect(
        service.deductConcessionStock([{ productId: 'ITEM-1', quantity: 5 }]),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getProductsByIds', () => {
    it('gọi itemService.getProductsByIds', async () => {
      const mockResult = new Map();
      mockItemService.getProductsByIds.mockResolvedValue(mockResult);

      const result = await service.getProductsByIds(['ITEM-1']);
      expect(mockItemService.getProductsByIds).toHaveBeenCalledWith(['ITEM-1']);
      expect(result).toBe(mockResult);
    });
  });
});
