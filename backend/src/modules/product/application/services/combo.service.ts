import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Page } from '../../../../common/dto/page.dto';
import { Role, BranchStatus, ComboStatus, ItemStatus } from '@prisma/client';
import {
  ChangeComboStatusReq,
  CreateComboReq,
  QueryBranchCombosReq,
  UpdateComboReq,
} from '../dto/req.dto';
import { ComboMutationRes, ComboRes, DeleteMutationRes } from '../dto/res.dto';
import { CreateComboUsecase } from '../usecase/create-combo.usecase';
import { UpdateComboUsecase } from '../usecase/update-combo.usecase';
import { QueryBranchCombosUsecase } from '../usecase/query-branch-combos.usecase';
import { GetComboDetailUsecase } from '../usecase/get-combo-detail.usecase';
import { ChangeComboStatusUsecase } from '../usecase/change-combo-status.usecase';
import { DeleteComboUsecase } from '../usecase/delete-combo.usecase';

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
  constructor(private readonly prisma: PrismaService) {}

  async createCombo(
    managerUserId: string,
    req: CreateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);

    const trimmedName = req.name.trim();
    const existing = await this.prisma.combo.findFirst({
      where: {
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Tên combo "${trimmedName}" đã tồn tại trong chi nhánh`,
      );
    }

    const itemIds = req.items.map((i) => i.itemId);
    this.validateUniqueItemIds(itemIds);
    const itemsMap = await this.fetchAndValidateBranchItems(branchId, itemIds);

    const initialStatus = (req.status as ComboStatus) || ComboStatus.AVAILABLE;

    const saved = await this.prisma.combo.create({
      data: {
        branchId,
        name: trimmedName,
        price: req.price,
        description: req.description?.trim() || null,
        imageKey: imageKey || req.imageKey || null,
        status: initialStatus,
        items: req.items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        })),
      },
    });

    const comboRes = this.mapToComboRes(saved, itemsMap);

    return {
      message: 'Tạo gói combo thành công',
      combo: comboRes,
    };
  }

  async updateCombo(
    managerUserId: string,
    comboId: string,
    req: UpdateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);

    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, branchId },
    });
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    const data: any = {};

    if (req.name !== undefined) {
      const trimmedName = req.name.trim();
      const duplicate = await this.prisma.combo.findFirst({
        where: {
          branchId,
          id: { not: comboId },
          name: { equals: trimmedName, mode: 'insensitive' },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Tên combo "${trimmedName}" đã tồn tại trong chi nhánh`,
        );
      }
      data.name = trimmedName;
    }

    if (req.price !== undefined) data.price = req.price;
    if (req.description !== undefined) {
      data.description = req.description ? req.description.trim() : null;
    }
    if (imageKey) {
      data.imageKey = imageKey;
    } else if (req.imageKey !== undefined) {
      data.imageKey = req.imageKey || null;
    }
    if (req.status !== undefined) data.status = req.status as ComboStatus;

    if (req.items !== undefined) {
      const itemIds = req.items.map((i) => i.itemId);
      this.validateUniqueItemIds(itemIds);
      await this.fetchAndValidateBranchItems(branchId, itemIds);
      data.items = req.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
      }));
    }

    const saved = await this.prisma.combo.update({
      where: { id: comboId },
      data,
    });

    const currentItemIds = (saved.items as any[])?.map((i) => i.itemId) ?? [];
    const itemsMap = await this.fetchItemsMap(currentItemIds);
    const comboRes = this.mapToComboRes(saved, itemsMap);

    return {
      message: 'Cập nhật gói combo thành công',
      combo: comboRes,
    };
  }

  async queryBranchCombos(
    managerUserId: string,
    query: QueryBranchCombosReq,
  ): Promise<Page<ComboRes>> {
    const branchId = await this.resolveManagerBranchId(managerUserId);

    const where: any = { branchId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const [total, combos] = await Promise.all([
      this.prisma.combo.count({ where }),
      this.prisma.combo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const itemIds = Array.from(
      new Set(
        combos.flatMap((c) => (c.items as any[])?.map((i) => i.itemId) ?? []),
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

    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, branchId },
    });
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    const itemIds = (combo.items as any[])?.map((i) => i.itemId) ?? [];
    const itemsMap = await this.fetchItemsMap(itemIds);

    return this.mapToComboRes(combo, itemsMap);
  }

  async changeComboStatus(
    managerUserId: string,
    comboId: string,
    req: ChangeComboStatusReq,
  ): Promise<ComboMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);

    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, branchId },
    });
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    const saved = await this.prisma.combo.update({
      where: { id: comboId },
      data: { status: req.status as ComboStatus },
    });

    const itemIds = (saved.items as any[])?.map((i) => i.itemId) ?? [];
    const itemsMap = await this.fetchItemsMap(itemIds);

    return {
      message: 'Cập nhật trạng thái combo thành công',
      combo: this.mapToComboRes(saved, itemsMap),
    };
  }

  async deleteCombo(
    managerUserId: string,
    comboId: string,
  ): Promise<DeleteMutationRes> {
    const branchId = await this.resolveManagerBranchId(managerUserId);

    const combo = await this.prisma.combo.findFirst({
      where: { id: comboId, branchId },
    });
    if (!combo) {
      throw new NotFoundException(
        'Không tìm thấy gói combo trong chi nhánh này',
      );
    }

    await this.prisma.combo.delete({ where: { id: comboId } });

    return {
      message: 'Xóa gói combo thành công',
      id: comboId,
    };
  }

  private async resolveManagerBranchId(managerUserId: string): Promise<string> {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: { role: true, isActive: true, branchId: true },
    });

    if (!manager) {
      throw new ForbiddenException('Không tìm thấy thông tin quản lý');
    }

    const isManager =
      manager.role === Role.MANAGER || (manager.role as any) === 'BRANCHMANAGER';
    if (!manager.isActive || !isManager) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện chức năng quản lý bắp nước',
      );
    }

    if (!manager.branchId) {
      throw new ForbiddenException(
        'Tài khoản quản lý chưa được gắn chi nhánh hoạt động',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: manager.branchId,
        branchStatus: BranchStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new ForbiddenException(
        'Chi nhánh không tồn tại hoặc đã ngừng hoạt động',
      );
    }

    return branch.id;
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
  ): Promise<Map<string, any>> {
    const items = await this.prisma.item.findMany({
      where: {
        id: { in: itemIds },
        branchId,
      },
    });

    const itemsMap = new Map(items.map((i) => [i.id, i]));

    for (const id of itemIds) {
      const item = itemsMap.get(id);
      if (!item) {
        throw new BadRequestException(
          `Món với mã "${id}" không tồn tại hoặc không thuộc chi nhánh hiện tại`,
        );
      }
      if (item.status === ItemStatus.INACTIVE) {
        throw new BadRequestException(
          `Món "${item.name}" đang ở trạng thái ngừng bán, không thể đưa vào combo`,
        );
      }
    }

    return itemsMap;
  }

  private async fetchItemsMap(itemIds: string[]): Promise<Map<string, any>> {
    if (itemIds.length === 0) return new Map();
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
    });
    return new Map(items.map((i) => [i.id, i]));
  }

  private mapToComboRes(combo: any, itemsMap: Map<string, any>): ComboRes {
    const rawItems: Array<{ itemId: string; quantity: number }> =
      combo.items ?? [];
    let originalTotalPrice = 0;
    let minStock = Number.MAX_SAFE_INTEGER;

    const resolvedItems = rawItems.map((sub) => {
      const item = itemsMap.get(sub.itemId);
      const unitPrice = item?.price ?? 0;
      const currentStock = item?.stockQuantity ?? 0;
      const isItemAvailable =
        item?.status === ItemStatus.AVAILABLE && currentStock >= sub.quantity;
      originalTotalPrice += unitPrice * sub.quantity;

      const possible =
        sub.quantity > 0 ? Math.floor(currentStock / sub.quantity) : 0;
      if (possible < minStock) {
        minStock = possible;
      }

      return {
        itemId: sub.itemId,
        name: item?.name ?? 'Món đã bị xoá',
        category: (item?.category as any) ?? 'OTHER',
        size: (item?.size as any) ?? null,
        quantity: sub.quantity,
        unitPrice,
        currentStock,
        isItemAvailable,
      };
    });

    if (rawItems.length === 0 || minStock === Number.MAX_SAFE_INTEGER) {
      minStock = 0;
    }

    const savingsAmount = Math.max(0, originalTotalPrice - combo.price);
    const isAvailable = combo.status === ComboStatus.AVAILABLE && minStock > 0;

    return {
      comboId: combo.id,
      branchId: combo.branchId,
      name: combo.name,
      price: combo.price,
      originalTotalPrice,
      savingsAmount,
      status: combo.status as any,
      availableStock: minStock,
      isAvailable,
      description: combo.description ?? null,
      imageKey: combo.imageKey ?? null,
      items: resolvedItems as any,
      createdAt: combo.createdAt
        ? new Date(combo.createdAt).toISOString()
        : undefined,
      updatedAt: combo.updatedAt
        ? new Date(combo.updatedAt).toISOString()
        : undefined,
    };
  }
}
