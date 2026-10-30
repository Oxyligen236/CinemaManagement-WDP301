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

  static from(params: {
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
    const dto = new ItemRes();
    Object.assign(dto, params);
    return dto;
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

  static from(params: {
    itemId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    quantity: number;
    unitPrice: number;
    currentStock: number;
    isItemAvailable: boolean;
  }): ComboItemDetailRes {
    const dto = new ComboItemDetailRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class ComboRes {
  comboId!: string;
  branchId!: string;
  name!: string;
  price!: number;
  originalTotalPrice!: number;
  savingsAmount!: number;
  status!: ComboStatus;
  availableStock!: number;
  isAvailable!: boolean;
  imageKey?: string | null;
  description?: string | null;
  items!: ComboItemDetailRes[];
  createdAt?: string;
  updatedAt?: string;

  static from(params: {
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
    const dto = new ComboRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class ManagerBranchRes {
  branchId!: string;
  branchName!: string;
  address?: string;

  static from(params: {
    branchId: string;
    branchName: string;
    address?: string;
  }): ManagerBranchRes {
    const dto = new ManagerBranchRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class ProductSummaryRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  unitPrice!: number;
  branchId?: string;

  static from(params: {
    productId: string;
    productName: string;
    imageUrl?: string;
    unitPrice: number;
    branchId?: string;
  }): ProductSummaryRes {
    const dto = new ProductSummaryRes();
    Object.assign(dto, params);
    return dto;
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
}

export class StockAdjustmentRes {
  message!: string;
  itemId!: string;
  previousStock!: number;
  currentStock!: number;
  status!: ItemStatus;

  static from(params: {
    message: string;
    itemId: string;
    previousStock: number;
    currentStock: number;
    status: ItemStatus;
  }): StockAdjustmentRes {
    const dto = new StockAdjustmentRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class ItemMutationRes {
  message!: string;
  item!: ItemRes;

  static from(params: { message: string; item: ItemRes }): ItemMutationRes {
    const dto = new ItemMutationRes();
    dto.message = params.message;
    dto.item = params.item;
    return dto;
  }
}

export class ComboMutationRes {
  message!: string;
  combo!: ComboRes;

  static from(params: { message: string; combo: ComboRes }): ComboMutationRes {
    const dto = new ComboMutationRes();
    dto.message = params.message;
    dto.combo = params.combo;
    return dto;
  }
}

export class DeleteMutationRes {
  message!: string;
  id!: string;

  static from(params: { message: string; id: string }): DeleteMutationRes {
    const dto = new DeleteMutationRes();
    dto.message = params.message;
    dto.id = params.id;
    return dto;
  }
}

export class ExcelRowErrorRes {
  rowNumber!: number;
  name?: string;
  reason!: string;
}

export class UploadConcessionImageRes {
  message!: string;
  imageUrl!: string;
  key!: string;
}

export class ImportItemsExcelRes {
  message!: string;
  totalRows!: number;
  successCount!: number;
  errorCount!: number;
  createdCount!: number;
  updatedCount!: number;
  errors!: ExcelRowErrorRes[];
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

  static from(params: {
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
    const dto = new BranchConcessionItemRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class BranchConcessionComboItemRes {
  itemId!: string;
  name!: string;
  quantity!: number;

  static from(params: {
    itemId: string;
    name: string;
    quantity: number;
  }): BranchConcessionComboItemRes {
    const dto = new BranchConcessionComboItemRes();
    Object.assign(dto, params);
    return dto;
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

  static from(params: {
    comboId: string;
    name: string;
    price: number;
    availableStock: number;
    imageKey?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    items: BranchConcessionComboItemRes[];
  }): BranchConcessionComboRes {
    const dto = new BranchConcessionComboRes();
    Object.assign(dto, params);
    return dto;
  }
}

export class BranchConcessionCatalogRes {
  branchId!: string;
  items!: BranchConcessionItemRes[];
  combos!: BranchConcessionComboRes[];

  static from(params: {
    branchId: string;
    items: BranchConcessionItemRes[];
    combos: BranchConcessionComboRes[];
  }): BranchConcessionCatalogRes {
    const dto = new BranchConcessionCatalogRes();
    dto.branchId = params.branchId;
    dto.items = params.items;
    dto.combos = params.combos;
    return dto;
  }
}
