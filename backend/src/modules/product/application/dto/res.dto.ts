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
}

export class ManagerBranchRes {
  branchId!: string;
  branchName!: string;
  address?: string;
}

export class ProductSummaryRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  unitPrice!: number;
  branchId?: string;
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
}

export class ItemMutationRes {
  message!: string;
  item!: ItemRes;
}

export class ComboMutationRes {
  message!: string;
  combo!: ComboRes;
}

export class DeleteMutationRes {
  message!: string;
  id!: string;
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
  description?: string | null;
}

export class BranchConcessionComboItemRes {
  itemId!: string;
  name!: string;
  quantity!: number;
}

export class BranchConcessionComboRes {
  comboId!: string;
  name!: string;
  price!: number;
  availableStock!: number;
  imageKey?: string | null;
  description?: string | null;
  items!: BranchConcessionComboItemRes[];
}

export class BranchConcessionCatalogRes {
  branchId!: string;
  items!: BranchConcessionItemRes[];
  combos!: BranchConcessionComboRes[];
}
