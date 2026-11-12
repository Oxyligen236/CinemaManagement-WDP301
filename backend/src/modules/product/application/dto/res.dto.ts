import { ItemCategory } from '../../domain/enums/item-category.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ItemSize } from '../../domain/enums/item-size.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';

export class ItemRes {
  itemId!: string;
  branchId!: string;
  name!: string;
  category!: ItemCategory;
  size?: ItemSize | null;
  price!: number;
  costPrice!: number;
  stockQuantity!: number;
  lowStockThreshold!: number;
  isLowStock!: boolean;
  status!: ItemStatus;
  imageKey?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;

  static of(params: {
    itemId: string;
    branchId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    price: number;
    costPrice: number;
    stockQuantity: number;
    lowStockThreshold: number;
    isLowStock: boolean;
    status: ItemStatus;
    imageKey?: string | null;
    description?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }): ItemRes {
    const res = new ItemRes();
    Object.assign(res, params);
    return res;
  }
}

export class ComboItemDetailRes {
  itemId!: string;
  name!: string;
  category!: ItemCategory;
  size?: ItemSize | null;
  quantity!: number;
  unitPrice!: number;
  currentStock!: number;
  isItemAvailable!: boolean;

  static of(params: {
    itemId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    quantity: number;
    unitPrice: number;
    currentStock: number;
    isItemAvailable: boolean;
  }): ComboItemDetailRes {
    const res = new ComboItemDetailRes();
    Object.assign(res, params);
    return res;
  }
}

export class ComboRes {
  comboId!: string;
  branchId!: string;
  name!: string;
  price!: number;
  originalTotalPrice!: number; // Tổng giá nếu mua lẻ từng món
  savingsAmount!: number; // Số tiền tiết kiệm khi mua gói combo
  status!: ComboStatus;
  availableStock!: number; // TỒN KHO ẢO ĐƯỢC TÍNH TOÁN ĐỘNG
  isAvailable!: boolean; // true nếu status=AVAILABLE và availableStock > 0
  imageKey?: string | null;
  description?: string | null;
  items!: ComboItemDetailRes[];
  createdAt?: string;
  updatedAt?: string;

  static of(params: {
    comboId: string;
    branchId: string;
    name: string;
    price: number;
    originalTotalPrice: number;
    savingsAmount: number;
    status: ComboStatus;
    availableStock: number;
    isAvailable: boolean;
    imageKey?: string | null;
    description?: string | null;
    items: ComboItemDetailRes[];
    createdAt?: string;
    updatedAt?: string;
  }): ComboRes {
    const res = new ComboRes();
    Object.assign(res, params);
    return res;
  }
}

export class ManagerBranchRes {
  branchId!: string;
  branchName!: string;
  address?: string;

  static of(
    branchId: string,
    branchName: string,
    address?: string,
  ): ManagerBranchRes {
    const res = new ManagerBranchRes();
    Object.assign(res, { branchId, branchName, address });
    return res;
  }
}

export class ProductSummaryRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  unitPrice!: number;
  branchId?: string;

  static of(
    productId: string,
    productName: string,
    unitPrice: number,
    imageUrl?: string,
    branchId?: string,
  ): ProductSummaryRes {
    const res = new ProductSummaryRes();
    Object.assign(res, {
      productId,
      productName,
      unitPrice,
      imageUrl,
      branchId,
    });
    return res;
  }
}

export class ConcessionOptionsRes {
  branch!: ManagerBranchRes;
  categories!: ItemCategory[];
  sizes!: ItemSize[];
  itemStatuses!: ItemStatus[];
  comboStatuses!: ComboStatus[];
  availableItemsForCombo!: Array<{
    itemId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    price: number;
    stockQuantity: number;
  }>;

  static of(
    branch: ManagerBranchRes,
    categories: ItemCategory[],
    sizes: ItemSize[],
    itemStatuses: ItemStatus[],
    comboStatuses: ComboStatus[],
    availableItemsForCombo: Array<{
      itemId: string;
      name: string;
      category: ItemCategory;
      size?: ItemSize | null;
      price: number;
      stockQuantity: number;
    }>,
  ): ConcessionOptionsRes {
    const res = new ConcessionOptionsRes();
    Object.assign(res, {
      branch,
      categories,
      sizes,
      itemStatuses,
      comboStatuses,
      availableItemsForCombo,
    });
    return res;
  }
}

export class StockAdjustmentRes {
  message!: string;
  itemId!: string;
  previousStock!: number;
  currentStock!: number;
  status!: ItemStatus;

  static of(
    message: string,
    itemId: string,
    previousStock: number,
    currentStock: number,
    status: ItemStatus,
  ): StockAdjustmentRes {
    const res = new StockAdjustmentRes();
    Object.assign(res, {
      message,
      itemId,
      previousStock,
      currentStock,
      status,
    });
    return res;
  }
}

export class ItemMutationRes {
  message!: string;
  item!: ItemRes;

  static of(message: string, item: ItemRes): ItemMutationRes {
    const res = new ItemMutationRes();
    Object.assign(res, { message, item });
    return res;
  }
}

export class ComboMutationRes {
  message!: string;
  combo!: ComboRes;

  static of(message: string, combo: ComboRes): ComboMutationRes {
    const res = new ComboMutationRes();
    Object.assign(res, { message, combo });
    return res;
  }
}

export class DeleteMutationRes {
  message!: string;
  id!: string;

  static of(message: string, id: string): DeleteMutationRes {
    const res = new DeleteMutationRes();
    Object.assign(res, { message, id });
    return res;
  }
}

export class ExcelRowErrorRes {
  rowNumber!: number;
  name?: string;
  reason!: string;

  static of(
    rowNumber: number,
    reason: string,
    name?: string,
  ): ExcelRowErrorRes {
    const res = new ExcelRowErrorRes();
    Object.assign(res, { rowNumber, reason, name });
    return res;
  }
}

export class UploadConcessionImageRes {
  message!: string;
  imageUrl!: string;
  key!: string;

  static of(
    message: string,
    imageUrl: string,
    key: string,
  ): UploadConcessionImageRes {
    const res = new UploadConcessionImageRes();
    Object.assign(res, { message, imageUrl, key });
    return res;
  }
}

export class ImportItemsExcelRes {
  message!: string;
  totalRows!: number;
  successCount!: number;
  errorCount!: number;
  createdCount!: number;
  updatedCount!: number;
  errors!: ExcelRowErrorRes[];

  static of(
    message: string,
    totalRows: number,
    successCount: number,
    errorCount: number,
    createdCount: number,
    updatedCount: number,
    errors: ExcelRowErrorRes[],
  ): ImportItemsExcelRes {
    const res = new ImportItemsExcelRes();
    Object.assign(res, {
      message,
      totalRows,
      successCount,
      errorCount,
      createdCount,
      updatedCount,
      errors,
    });
    return res;
  }
}

export class BranchConcessionItemRes {
  itemId!: string;
  name!: string;
  category!: ItemCategory;
  size?: ItemSize | null;
  price!: number;
  stockQuantity!: number;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;

  static of(params: {
    itemId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    price: number;
    stockQuantity: number;
    imageKey?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  }): BranchConcessionItemRes {
    const res = new BranchConcessionItemRes();
    Object.assign(res, params);
    return res;
  }
}

export class BranchConcessionComboItemRes {
  itemId!: string;
  name!: string;
  quantity!: number;

  static of(
    itemId: string,
    name: string,
    quantity: number,
  ): BranchConcessionComboItemRes {
    const res = new BranchConcessionComboItemRes();
    Object.assign(res, { itemId, name, quantity });
    return res;
  }
}

export class BranchConcessionComboRes {
  comboId!: string;
  name!: string;
  price!: number;
  availableStock!: number;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  items!: BranchConcessionComboItemRes[];

  static of(params: {
    comboId: string;
    name: string;
    price: number;
    availableStock: number;
    imageKey?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    items: BranchConcessionComboItemRes[];
  }): BranchConcessionComboRes {
    const res = new BranchConcessionComboRes();
    Object.assign(res, params);
    return res;
  }
}

export class BranchConcessionCatalogRes {
  branchId!: string;
  items!: BranchConcessionItemRes[];
  combos!: BranchConcessionComboRes[];

  static of(
    branchId: string,
    items: BranchConcessionItemRes[],
    combos: BranchConcessionComboRes[],
  ): BranchConcessionCatalogRes {
    const res = new BranchConcessionCatalogRes();
    Object.assign(res, { branchId, items, combos });
    return res;
  }
}
