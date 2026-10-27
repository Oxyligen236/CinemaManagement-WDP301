import { ProductContractImpl } from './product-contract.impl';
import { ProductService } from '../application/services/product.service';

describe('ProductContractImpl', () => {
  let contract: ProductContractImpl;
  let mockProductService: {
    getProductsByIds: jest.Mock;
    deductConcessionStock: jest.Mock;
  };

  beforeEach(() => {
    mockProductService = {
      getProductsByIds: jest.fn(),
      deductConcessionStock: jest.fn(),
    };
    contract = new ProductContractImpl(
      mockProductService as unknown as ProductService,
    );
  });

  it('lấy danh sách sản phẩm theo map id', async () => {
    const mockMap = new Map([
      [
        'p-1',
        {
          productId: 'p-1',
          productName: 'Bắp rang bơ',
          imageUrl: 'bap.jpg',
          unitPrice: 50000,
          branchId: 'b-1',
        },
      ],
    ]);
    mockProductService.getProductsByIds.mockResolvedValue(mockMap);

    const result = await contract.getProductsByIds(['p-1']);
    expect(result.size).toBe(1);
    expect(result.get('p-1')).toEqual({
      productId: 'p-1',
      productName: 'Bắp rang bơ',
      imageUrl: 'bap.jpg',
      unitPrice: 50000,
      branchId: 'b-1',
    });
  });

  it('gọi deductConcessionStock từ ProductService', async () => {
    mockProductService.deductConcessionStock.mockResolvedValue(undefined);
    await contract.deductConcessionStock([{ productId: 'p-1', quantity: 2 }]);
    expect(mockProductService.deductConcessionStock).toHaveBeenCalledWith([
      { productId: 'p-1', quantity: 2 },
    ]);
  });
});
