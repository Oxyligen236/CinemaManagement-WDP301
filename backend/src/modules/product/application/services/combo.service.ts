import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Combo, ComboDocument } from '../../domain/schemas/combo.schema';
import { Item, ItemDocument } from '../../domain/schemas/item.schema';
import { User, UserDocument } from '../../../user/domain/schemas/user.schema';
import {
  Branch,
  BranchDocument,
} from '../../../branch/domain/schemas/branch.schema';
import { Role } from '../../../user/domain/enums/role.enum';
import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ItemCategory } from '../../domain/enums/item-category.enum';
import {
  ChangeComboStatusReq,
  CreateComboReq,
  QueryBranchCombosReq,
  UpdateComboReq,
} from '../dto/req.dto';
import {
  ComboItemDetailRes,
  ComboMutationRes,
  ComboRes,
  DeleteMutationRes,
} from '../dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';
import { CreateComboUsecase } from '../usecase/create-combo.usecase';
import { UpdateComboUsecase } from '../usecase/update-combo.usecase';
import { QueryBranchCombosUsecase } from '../usecase/query-branch-combos.usecase';
import { GetComboDetailUsecase } from '../usecase/get-combo-detail.usecase';
import { ChangeComboStatusUsecase } from '../usecase/change-combo-status.usecase';
import { DeleteComboUsecase } from '../usecase/delete-combo.usecase';

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

@Injectable()
export class ComboService
  implements
    CreateComboUsecase,
    UpdateComboUsecase,
    QueryBranchCombosUsecase,
    GetComboDetailUsecase,
    ChangeComboStatusUsecase,
    DeleteComboUsecase
{
  constructor(
    @InjectModel(Combo.name)
    private readonly comboModel: Model<ComboDocument>,
    @InjectModel(Item.name)
    private readonly itemModel: Model<ItemDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async createCombo(
    managerUserId: string,
    req: CreateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);

    const trimmedName = req.name.trim();
    const existing = await this.comboModel
      .findOne({ branchId: branchObjId, name: trimmedName })
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException(
        `Tên combo "${trimmedName}" đã tồn tại trong chi nhánh`,
      );
    }

    this.validateUniqueItemIds(req.items.map((i) => i.itemId));
    const itemsMap = await this.fetchAndValidateBranchItems(
      branchId,
      req.items.map((i) => i.itemId),
    );

    const finalImageKey = imageKey ?? req.imageKey ?? null;
    const newCombo = new this.comboModel({
      branchId: branchObjId,
      name: trimmedName,
      price: req.price,
      status: req.status ?? ComboStatus.AVAILABLE,
      imageKey: finalImageKey,
      description: req.description?.trim() ?? null,
      items: req.items.map((i) => ({
        itemId: toObjectId(i.itemId),
        quantity: i.quantity,
      })),
    });

    const saved = await newCombo.save();
    const comboRes = this.mapToComboRes(saved.toObject(), itemsMap);

    return ComboMutationRes.from({
      message: 'Tạo gói combo thành công',
      combo: comboRes,
    });
  }

  async updateCombo(
    managerUserId: string,
    comboId: string,
    req: UpdateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);
    const comboObjId = toObjectId(comboId);

    const combo = await this.comboModel
      .findOne({ _id: comboObjId, branchId: branchObjId })
      .exec();
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    if (req.name !== undefined) {
      const trimmedName = req.name.trim();
      const duplicate = await this.comboModel
        .findOne({
          branchId: branchObjId,
          name: trimmedName,
          _id: { $ne: comboObjId },
        })
        .lean()
        .exec();
      if (duplicate) {
        throw new ConflictException(
          `Tên combo "${trimmedName}" đã tồn tại trong chi nhánh`,
        );
      }
      combo.name = trimmedName;
    }

    if (req.price !== undefined) {
      combo.price = req.price;
    }

    if (req.status !== undefined) {
      combo.status = req.status;
    }

    if (req.description !== undefined) {
      combo.description = req.description ? req.description.trim() : null;
    }

    if (imageKey) {
      combo.imageKey = imageKey;
    } else if (req.imageKey !== undefined) {
      combo.imageKey = req.imageKey || null;
    }

    if (req.items && req.items.length > 0) {
      this.validateUniqueItemIds(req.items.map((i) => i.itemId));
      await this.fetchAndValidateBranchItems(
        branchId,
        req.items.map((i) => i.itemId),
      );
      combo.items = req.items.map((i) => ({
        itemId: toObjectId(i.itemId),
        quantity: i.quantity,
      }));
    }

    const updated = await combo.save();

    const allItemIds = updated.items.map((i) => i.itemId.toString());
    const itemsMap = await this.fetchItemsMap(allItemIds);
    const comboRes = this.mapToComboRes(updated.toObject(), itemsMap);

    return ComboMutationRes.from({
      message: 'Cập nhật gói combo thành công',
      combo: comboRes,
    });
  }

  async queryBranchCombos(
    managerUserId: string,
    req: QueryBranchCombosReq,
  ): Promise<Page<ComboRes>> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);

    const filter: Record<string, unknown> = { branchId: branchObjId };

    if (req.status) {
      filter.status = req.status;
    }

    if (req.search) {
      const escaped = req.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    const page = Math.max(1, Number(req.page) || 1);
    const limit = Math.max(1, Number(req.limit) || 10);
    const skip = (page - 1) * limit;

    const [total, combos] = await Promise.all([
      this.comboModel.countDocuments(filter).exec(),
      this.comboModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const itemIds = Array.from(
      new Set(
        combos.flatMap((c) => c.items?.map((i) => i.itemId.toString()) ?? []),
      ),
    );
    const itemsMap = await this.fetchItemsMap(itemIds);

    const comboResList = combos.map((c) => this.mapToComboRes(c, itemsMap));

    return Page.from(comboResList, total, page, limit);
  }

  async getComboDetail(
    managerUserId: string,
    comboId: string,
  ): Promise<ComboRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);
    const comboObjId = toObjectId(comboId);

    const combo = await this.comboModel
      .findOne({ _id: comboObjId, branchId: branchObjId })
      .lean()
      .exec();
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    const itemIds = combo.items?.map((i) => i.itemId.toString()) ?? [];
    const itemsMap = await this.fetchItemsMap(itemIds);

    return this.mapToComboRes(combo, itemsMap);
  }

  async changeComboStatus(
    managerUserId: string,
    comboId: string,
    req: ChangeComboStatusReq,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);
    const comboObjId = toObjectId(comboId);

    const combo = await this.comboModel
      .findOne({ _id: comboObjId, branchId: branchObjId })
      .exec();
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    combo.status = req.status;
    const updated = await combo.save();

    const itemIds = updated.items?.map((i) => i.itemId.toString()) ?? [];
    const itemsMap = await this.fetchItemsMap(itemIds);

    return ComboMutationRes.from({
      message: 'Thay đổi trạng thái combo thành công',
      combo: this.mapToComboRes(updated.toObject(), itemsMap),
    });
  }

  async deleteCombo(
    managerUserId: string,
    comboId: string,
  ): Promise<DeleteMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);
    const branchObjId = toObjectId(branchId);
    const comboObjId = toObjectId(comboId);

    const result = await this.comboModel
      .deleteOne({ _id: comboObjId, branchId: branchObjId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        'Không tìm thấy gói combo cần xóa trong chi nhánh này',
      );
    }

    return DeleteMutationRes.from({
      message: 'Xóa gói combo thành công',
      id: comboId,
    });
  }

  private async resolveManagerBranchId(managerUserId: string): Promise<string> {
    const userObjId = toObjectId(managerUserId);
    const manager = await this.userModel
      .findOne({ _id: userObjId, role: Role.BRANCHMANAGER })
      .select('_id branchId isActive')
      .lean()
      .exec();

    if (!manager) {
      throw new ForbiddenException('Bạn không có quyền quản lý chi nhánh');
    }

    if (!manager.branchId) {
      throw new ForbiddenException(
        'Tài khoản quản lý chưa được gắn chi nhánh hoạt động',
      );
    }

    const branch = await this.branchModel
      .findOne({
        _id: toObjectId(manager.branchId),
        branchStatus: BranchStatus.ACTIVE,
      })
      .select('_id')
      .lean()
      .exec();

    if (!branch) {
      throw new ForbiddenException(
        'Chi nhánh không tồn tại hoặc đã ngừng hoạt động',
      );
    }

    return branch._id.toString();
  }

  private validateUniqueItemIds(itemIds: string[]): void {
    const seen = new Set<string>();
    for (const id of itemIds) {
      if (seen.has(id)) {
        throw new BadRequestException(
          'Danh sách món trong combo không được chứa món trùng lặp',
        );
      }
      seen.add(id);
    }
  }

  private async fetchAndValidateBranchItems(
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, ItemDocument>> {
    const branchObjId = toObjectId(branchId);
    const itemObjIds = itemIds.map(toObjectId);
    const items = await this.itemModel
      .find({ _id: { $in: itemObjIds }, branchId: branchObjId })
      .exec();

    if (items.length !== itemIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều món con không tồn tại hoặc không thuộc chi nhánh này',
      );
    }

    const map = new Map<string, ItemDocument>();
    for (const item of items) {
      const idStr = (item._id ?? (item as any).itemId)?.toString();
      map.set(idStr, item);
    }
    return map;
  }

  private async fetchItemsMap(itemIds: string[]): Promise<Map<string, Item>> {
    if (!itemIds || itemIds.length === 0) {
      return new Map();
    }
    const itemObjIds = itemIds.map(toObjectId);
    const items = await this.itemModel
      .find({ _id: { $in: itemObjIds } })
      .lean()
      .exec();

    const map = new Map<string, Item>();
    for (const item of items) {
      const idStr = (item._id ?? (item as any).itemId)?.toString();
      map.set(idStr, item);
    }
    return map;
  }

  private mapToComboRes(
    combo: Combo,
    itemsMap: Map<string, Item | ItemDocument>,
  ): ComboRes {
    const itemDetails: ComboItemDetailRes[] = [];
    let originalTotalPrice = 0;
    const stockLimits: number[] = [];
    let allItemsAvailable = true;

    for (const ref of combo.items || []) {
      const refItemIdStr = ref.itemId.toString();
      const item = itemsMap.get(refItemIdStr);
      const isItemAvailable =
        Boolean(item) &&
        item!.status === ItemStatus.AVAILABLE &&
        item!.stockQuantity >= ref.quantity;

      if (!isItemAvailable) {
        allItemsAvailable = false;
      }

      const currentStock = item ? item.stockQuantity : 0;
      const unitPrice = item ? item.price : 0;

      originalTotalPrice += unitPrice * ref.quantity;

      if (item && item.status === ItemStatus.AVAILABLE) {
        stockLimits.push(Math.floor(currentStock / ref.quantity));
      } else {
        stockLimits.push(0);
      }

      itemDetails.push(
        ComboItemDetailRes.from({
          itemId: refItemIdStr,
          name: item ? item.name : 'Món không tồn tại',
          category: item ? item.category : ItemCategory.OTHER,
          size: item?.size ?? null,
          quantity: ref.quantity,
          unitPrice,
          currentStock,
          isItemAvailable,
        }),
      );
    }

    const availableStock =
      stockLimits.length > 0 ? Math.min(...stockLimits) : 0;

    const isAvailable =
      combo.status === ComboStatus.AVAILABLE &&
      availableStock > 0 &&
      allItemsAvailable;

    const savingsAmount = Math.max(0, originalTotalPrice - combo.price);
    const comboIdStr = (combo._id ?? (combo as any).comboId)?.toString();
    const branchIdStr = (combo.branchId ?? '').toString();

    return ComboRes.from({
      comboId: comboIdStr,
      branchId: branchIdStr,
      name: combo.name,
      price: combo.price,
      originalTotalPrice,
      savingsAmount,
      status: combo.status,
      availableStock,
      isAvailable,
      imageKey: combo.imageKey ?? null,
      description: combo.description ?? null,
      items: itemDetails,
      createdAt: combo.createdAt ? combo.createdAt.toISOString() : undefined,
      updatedAt: combo.updatedAt ? combo.updatedAt.toISOString() : undefined,
    });
  }
}
