import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page } from '../../../../common/dto/page.dto';
import { Order, OrderDocument } from '../../domain/schemas/order.schema';
import {
  SeatOrder,
  SeatOrderDocument,
} from '../../domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderDocument,
} from '../../domain/schemas/product-order.schema';
import {
  TicketContract,
  TICKET_CONTRACT,
} from '../../contracts/ticket.contract';
import {
  ProductContract,
  PRODUCT_CONTRACT,
  ProductSummaryDto,
} from '../../contracts/product.contract';
import {
  PromotionContract,
  PROMOTION_CONTRACT,
} from '../../contracts/promotion.contract';
import {
  QueryMyOrdersReq,
  QueryStaffOrdersReq,
  QueryAdminOrdersReq,
} from '../dto/req.dto';
import {
  OrderDetailRes,
  OrderItemProductRes,
  OrderItemTicketRes,
  OrderSummaryRes,
  PromotionSummaryRes,
} from '../dto/res.dto';
import { GetMyOrderHistoryUsecase } from '../usecase/get-my-order-history.usecase';
import { GetOrderDetailUsecase } from '../usecase/get-order-detail.usecase';
import { QueryStaffOrdersUsecase } from '../usecase/query-staff-orders.usecase';
import { QueryAdminOrdersUsecase } from '../usecase/query-admin-orders.usecase';

@Injectable()
export class OrderService
  implements
    GetMyOrderHistoryUsecase,
    GetOrderDetailUsecase,
    QueryStaffOrdersUsecase,
    QueryAdminOrdersUsecase
{
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrderModel: Model<ProductOrderDocument>,
    @Inject(TICKET_CONTRACT)
    private readonly ticketContract: TicketContract,
    @Inject(PRODUCT_CONTRACT)
    private readonly productContract: ProductContract,
    @Inject(PROMOTION_CONTRACT)
    private readonly promotionContract: PromotionContract,
  ) {}

  async getMyOrderHistory(
    userId: string,
    query: QueryMyOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const filter: Record<string, unknown> = { userId };
    if (query.status) {
      filter.status = query.status;
    }

    return this.paginateOrders(filter, query.page, query.limit);
  }

  async queryStaffOrders(
    query: QueryStaffOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.date) {
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    return this.paginateOrders(filter, query.page, query.limit);
  }

  async queryAdminOrders(
    query: QueryAdminOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const filter: Record<string, unknown> = {};
    if (query.userId) {
      filter.userId = query.userId;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.fromDate || query.toDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (query.fromDate) {
        dateFilter.$gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        dateFilter.$lte = new Date(query.toDate);
      }
      filter.createdAt = dateFilter;
    }

    return this.paginateOrders(filter, query.page, query.limit);
  }

  async getOrderDetail(orderId: string): Promise<OrderDetailRes> {
    const order = await this.orderModel.findOne({ orderId }).lean().exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const [ticketsFromContract, productOrders] = await Promise.all([
      this.ticketContract.getTicketsByOrderId(orderId),
      this.productOrderModel.find({ orderId }).lean().exec(),
    ]);

    const tickets: OrderItemTicketRes[] = ticketsFromContract.map((t) =>
      OrderItemTicketRes.of(
        t.ticketId,
        t.ticketCode,
        t.price,
        t.ticketStatus,
        t.usedAt,
        t.movieTitle,
        t.roomName,
        t.seatLabel,
        t.startTime,
      ),
    );

    const productIds = productOrders.map((po) => po.productId);
    const productsMap =
      productIds.length > 0
        ? await this.productContract.getProductsByIds(productIds)
        : new Map<string, ProductSummaryDto>();

    const products: OrderItemProductRes[] = productOrders.map((po) => {
      const prodInfo = productsMap.get(po.productId);
      return OrderItemProductRes.of(
        po.productId,
        prodInfo?.productName ?? po.productId,
        prodInfo?.imageUrl,
        po.quantity,
        po.unitPrice,
        po.quantity * po.unitPrice,
      );
    });

    let promotion: PromotionSummaryRes | undefined;
    if (order.promotionId) {
      const promoInfo = await this.promotionContract.getPromotionById(
        order.promotionId,
      );
      if (promoInfo) {
        const ticketSubtotal = tickets.reduce((acc, t) => acc + t.price, 0);
        const productSubtotal = products.reduce(
          (acc, p) => acc + p.subTotal,
          0,
        );
        const originalTotal = ticketSubtotal + productSubtotal;
        const discountAmount = Math.max(0, originalTotal - order.totalAmount);

        promotion = PromotionSummaryRes.of(
          promoInfo.promotionId,
          promoInfo.promotionCode,
          promoInfo.discountType,
          promoInfo.discountValue,
          discountAmount,
        );
      }
    }

    return OrderDetailRes.of(
      order.orderId,
      order.userId,
      order.totalAmount,
      order.status,
      (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
      tickets,
      products,
      promotion,
    );
  }

  private async paginateOrders(
    filter: Record<string, unknown>,
    page: number = 1,
    limit: number = 10,
  ): Promise<Page<OrderSummaryRes>> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    const orderIds = orders.map((o) => o.orderId);

    const [seatOrders, productOrders] = await Promise.all([
      this.seatOrderModel
        .find({ orderId: { $in: orderIds } })
        .lean()
        .exec(),
      this.productOrderModel
        .find({ orderId: { $in: orderIds } })
        .lean()
        .exec(),
    ]);

    const ticketCountMap = new Map<string, number>();
    for (const so of seatOrders) {
      ticketCountMap.set(so.orderId, (ticketCountMap.get(so.orderId) ?? 0) + 1);
    }

    const hasProductsMap = new Set<string>();
    for (const po of productOrders) {
      hasProductsMap.add(po.orderId);
    }

    const items: OrderSummaryRes[] = orders.map((o) =>
      OrderSummaryRes.of(
        o.orderId,
        o.userId,
        o.totalAmount,
        o.status,
        (o as unknown as { createdAt?: Date }).createdAt ?? new Date(),
        ticketCountMap.get(o.orderId) ?? 0,
        hasProductsMap.has(o.orderId),
      ),
    );

    return Page.from(items, total, page, limit);
  }
}
