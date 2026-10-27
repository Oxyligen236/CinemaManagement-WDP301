import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { ProductService } from './product.service';
import { ItemDocument } from '../../domain/schemas/item.schema';
import { ComboDocument } from '../../domain/schemas/combo.schema';
import { BranchDocument } from '../../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import { ItemCategory } from '../../domain/enums/item-category.enum';
import { ItemService } from './item.service';

describe('ProductService', () => {
  let service: ProductService;

  let mockItemModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };

  let mockComboModel: {
    find: jest.Mock;
  };

  let mockBranchModel: {
    findOne: jest.Mock;
  };

  let mockItemService: {
    getProductsByIds: jest.Mock;
  };

  beforeEach(() => {
    mockItemModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
    };

    mockComboModel = {
      find: jest.fn(),
    };

    mockBranchModel = {
      findOne: jest.fn(),
    };

    mockItemService = {
      getProductsByIds: jest.fn(),
    };

    service = new ProductService(
      mockItemModel as unknown as Model<ItemDocument>,
      mockComboModel as unknown as Model<ComboDocument>,
      mockBranchModel as unknown as Model<BranchDocument>,
      mockItemService as unknown as ItemService,
    );
  });

  describe('getBranchConcessions', () => {
    it('ném NotFoundException khi chi nhánh không tồn tại hoặc ngưng hoạt động', async () => {
      mockBranchModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getBranchConcessions('BRANCH-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về danh mục concessions của chi nhánh bao gồm items và combo tính tồn kho khả dụng', async () => {
      mockBranchModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            branchId: 'BRANCH-1',
            name: 'Chi nhánh Hà Nội',
            branchStatus: BranchStatus.ACTIVE,
          }),
        }),
      });

      const mockItems = [
        {
          itemId: 'ITEM-POPCORN',
          branchId: 'BRANCH-1',
          name: 'Bắp rang bơ',
          category: ItemCategory.POPCORN,
          price: 50000,
          stockQuantity: 10,
          status: ItemStatus.AVAILABLE,
        },
        {
          itemId: 'ITEM-COKE',
          branchId: 'BRANCH-1',
          name: 'Coca Cola',
          category: ItemCategory.BEVERAGE,
          price: 30000,
          stockQuantity: 20,
          status: ItemStatus.AVAILABLE,
        },
      ];

      const mockCombos = [
        {
          comboId: 'COMBO-1',
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

      mockItemModel.find
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockItems),
            }),
          }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockCombos),
        }),
      });

      const result = await service.getBranchConcessions('BRANCH-1');

      expect(result.branchId).toBe('BRANCH-1');
      expect(result.items).toHaveLength(2);
      expect(result.combos).toHaveLength(1);
      // min(10/1, 20/2) = min(10, 10) = 10
      expect(result.combos[0].availableStock).toBe(10);
    });

    it('bỏ qua combo nếu có món con không đủ tồn kho hoặc không khả dụng', async () => {
      mockBranchModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            branchId: 'BRANCH-1',
            branchStatus: BranchStatus.ACTIVE,
          }),
        }),
      });

      mockItemModel.find
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                itemId: 'ITEM-POPCORN',
                stockQuantity: 0,
                status: ItemStatus.OUT_OF_STOCK,
              },
            ]),
          }),
        });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              comboId: 'COMBO-EMPTY',
              name: 'Combo Empty',
              price: 80000,
              status: ComboStatus.AVAILABLE,
              items: [{ itemId: 'ITEM-POPCORN', quantity: 1 }],
            },
          ]),
        }),
      });

      const result = await service.getBranchConcessions('BRANCH-1');
      expect(result.combos).toHaveLength(0);
    });
  });

  describe('deductConcessionStock', () => {
    it('không thực hiện gì khi danh sách sản phẩm rỗng', async () => {
      await service.deductConcessionStock( []);
      expect(mockItemModel.find).not.toHaveBeenCalled();
    });

    it('khấu trừ tồn kho cho món lẻ thành công', async () => {
      mockItemModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              itemId: 'ITEM-1',
              stockQuantity: 5,
              status: ItemStatus.AVAILABLE,
            },
          ]),
        }),
      });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockItemModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          itemId: 'ITEM-1',
          stockQuantity: 3,
          status: ItemStatus.AVAILABLE,
        }),
      });

      await service.deductConcessionStock( [
        { productId: 'ITEM-1', quantity: 2 },
      ]);

      expect(mockItemModel.findOneAndUpdate).toHaveBeenCalledWith(
        { itemId: 'ITEM-1', stockQuantity: { $gte: 2 } },
        { $inc: { stockQuantity: -2 } },
        { new: true },
      );
      expect(mockItemModel.updateOne).not.toHaveBeenCalled();
    });

    it('chuyển trạng thái OUT_OF_STOCK khi tồn kho về 0', async () => {
      mockItemModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              itemId: 'ITEM-1',
              stockQuantity: 2,
              status: ItemStatus.AVAILABLE,
            },
          ]),
        }),
      });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockItemModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          itemId: 'ITEM-1',
          stockQuantity: 0,
          status: ItemStatus.AVAILABLE,
        }),
      });

      mockItemModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.deductConcessionStock( [
        { productId: 'ITEM-1', quantity: 2 },
      ]);

      expect(mockItemModel.updateOne).toHaveBeenCalledWith(
        { itemId: 'ITEM-1' },
        { $set: { status: ItemStatus.OUT_OF_STOCK } },
        {},
      );
    });

    it('khấu trừ tồn kho từ combo nhân với số lượng từng món con', async () => {
      mockItemModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              comboId: 'COMBO-1',
              items: [
                { itemId: 'ITEM-POPCORN', quantity: 2 },
                { itemId: 'ITEM-COKE', quantity: 1 },
              ],
            },
          ]),
        }),
      });

      mockItemModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          stockQuantity: 5,
          status: ItemStatus.AVAILABLE,
        }),
      });

      // Mua 2 combo: ITEM-POPCORN cần trừ 2*2=4, ITEM-COKE cần trừ 1*2=2
      await service.deductConcessionStock( [
        { productId: 'COMBO-1', quantity: 2 },
      ]);

      expect(mockItemModel.findOneAndUpdate).toHaveBeenCalledWith(
        { itemId: 'ITEM-POPCORN', stockQuantity: { $gte: 4 } },
        { $inc: { stockQuantity: -4 } },
        { new: true },
      );
      expect(mockItemModel.findOneAndUpdate).toHaveBeenCalledWith(
        { itemId: 'ITEM-COKE', stockQuantity: { $gte: 2 } },
        { $inc: { stockQuantity: -2 } },
        { new: true },
      );
    });

    it('ném NotFoundException khi không tìm thấy mã sản phẩm', async () => {
      mockItemModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        service.deductConcessionStock( [
          { productId: 'UNKNOWN-ID', quantity: 1 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném ConflictException khi sản phẩm không đủ tồn kho', async () => {
      mockItemModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([
              { itemId: 'ITEM-1', name: 'Bắp rang', stockQuantity: 1 },
            ]),
        }),
      });

      mockComboModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      // findOneAndUpdate trả về null do không thỏa điều kiện $gte
      mockItemModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockItemModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              name: 'Bắp rang',
              stockQuantity: 1,
            }),
          }),
        }),
      });

      await expect(
        service.deductConcessionStock( [{ productId: 'ITEM-1', quantity: 5 }]),
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


