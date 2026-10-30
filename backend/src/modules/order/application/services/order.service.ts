import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
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
import { OrderStatus } from '../../domain/enums/order-status.enum';
import {
  ORDER_EXPIRATION_QUEUE,
  ORDER_HOLD_TIMEOUT_MS,
} from '../../domain/constants/order.constant';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';
import { OrderExpiredEvent } from '../../domain/events/order-expired.event';
import { OrderPaidEvent } from '../../domain/events/order-paid.event';
import { OrderCancelledEvent } from '../../domain/events/order-cancelled.event';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import {
  PaymentContract,
  PAYMENT_CONTRACT,
} from '../../contracts/payment.contract';
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
  SHOWTIME_BOOKING,
  ShowtimeBookingContract,
} from '../../contracts/showtime-booking.contract';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import {
  ApplyPromotionReq,
  CancelOrderReq,
  CreateBookingOrderReq,
  QueryAdminOrdersReq,
  QueryMyOrdersReq,
  QueryStaffOrdersReq,
} from '../dto/req.dto';
import {
  BookingProductRes,
  BookingSeatRes,
  BookingSummaryRes,
  CancelOrderRes,
  OrderDetailRes,
  OrderItemProductRes,
  OrderItemTicketRes,
  OrderSummaryRes,
  PromotionSummaryRes,
} from '../dto/res.dto';
import { CreateBookingOrderUsecase } from '../usecase/create-booking-order.usecase';
import { GetBookingSummaryUsecase } from '../usecase/get-booking-summary.usecase';
import { ExpireOrderUsecase } from '../usecase/expire-order.usecase';
import { ApplyPromotionUsecase } from '../usecase/apply-promotion.usecase';
import { GetMyOrderHistoryUsecase } from '../usecase/get-my-order-history.usecase';
import { GetOrderDetailUsecase } from '../usecase/get-order-detail.usecase';
import { QueryStaffOrdersUsecase } from '../usecase/query-staff-orders.usecase';
import { QueryAdminOrdersUsecase } from '../usecase/query-admin-orders.usecase';
import { CancelOrderUsecase } from '../usecase/cancel-order.usecase';

@Injectable()
export class OrderService
  implements
    CreateBookingOrderUsecase,
    GetBookingSummaryUsecase,
    ExpireOrderUsecase,
    ApplyPromotionUsecase,
    GetMyOrderHistoryUsecase,
    GetOrderDetailUsecase,
    QueryStaffOrdersUsecase,
    QueryAdminOrdersUsecase,
    CancelOrderUsecase
{
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrderModel: Model<ProductOrderDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(PAYMENT_CONTRACT)
    private readonly paymentContract: PaymentContract,
    @Inject(TICKET_CONTRACT)
    private readonly ticketContract: TicketContract,
    @Inject(PRODUCT_CONTRACT)
    private readonly productContract: ProductContract,
    @Inject(PROMOTION_CONTRACT)
    private readonly promotionContract: PromotionContract,
    @Inject(SHOWTIME_BOOKING)
    private readonly showtimeBookingService: ShowtimeBookingContract,
    @Inject(QUEUE_SERVICE)
    private readonly queueService: QueueService,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly internalEventBus: InternalEventBus,
    private readonly branchQueryService: BranchQueryService,
  ) {}

  private getOrderId(order: unknown): string {
    const o = order as { _id?: { toString(): string }; orderId?: string };
    return o._id ? o._id.toString() : o.orderId || '';
  }

  private findOrderQuery(orderId: string) {
    return Types.ObjectId.isValid(orderId)
      ? { $or: [{ _id: new Types.ObjectId(orderId) }, { orderId }] }
      : { orderId };
  }

  private findOrderById(orderId: string) {
    if (typeof this.orderModel.findById === 'function') {
      return this.orderModel.findById(orderId);
    }
    return this.orderModel.findOne(this.findOrderQuery(orderId));
  }

  private toOrderObjectId(orderId: string): Types.ObjectId {
    return Types.ObjectId.isValid(orderId)
      ? new Types.ObjectId(orderId)
      : (orderId as unknown as Types.ObjectId);
  }

  async createVnpayPayment(userId: string, orderId: string, ipAddr: string) {
    const order = await this.findOrderById(orderId).exec();
    if (!order)
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    if (order.userId.toString() !== userId)
      throw new ForbiddenException('You do not have access to this order');
    if (order.status !== OrderStatus.PENDING)
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    const returnUrl = process.env.VNPAY_RETURN_URL;
    if (!returnUrl)
      throw new BadRequestException('VNPAY_RETURN_URL chưa được cấu hình');
    return this.paymentContract.createVnpayPayment({
      orderId,
      amount: order.totalAmount,
      ipAddr,
      returnUrl,
    });
  }

  async handleVnpayReturn(query: Record<string, string | string[]>) {
    const result = await this.paymentContract.verifyVnpayReturn(query);
    if (!result.isSuccess) return result;
    // Return URL is the completion path when VNPay IPN is unavailable.
    await this.fulfillVnpayOrder(result.orderId);
    return result;
  }

  async handleVnpayIpn(query: Record<string, string | string[]>) {
    const result = await this.paymentContract.verifyVnpayIpn(query);
    if (result.RspCode !== '00' || !result.isSuccess || !result.orderId)
      return result;
    await this.fulfillVnpayOrder(result.orderId);
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  private async fulfillVnpayOrder(orderId: string) {
    const order = await this.findOrderById(orderId).exec();
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }
    if (order.status === OrderStatus.PAID)
      return { RspCode: '00', Message: 'Confirm Success' };
    if (order.status !== OrderStatus.PENDING)
      return { RspCode: '02', Message: 'Order not pending' };

    const orderObjectId = this.toOrderObjectId(orderId);
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const currentOrderQuery = this.findOrderById(orderId);
        const currentOrder =
          typeof currentOrderQuery.session === 'function'
            ? await currentOrderQuery.session(session).exec()
            : await currentOrderQuery.exec();
        if (currentOrder?.status === OrderStatus.PAID) return;
        if (!currentOrder || currentOrder.status !== OrderStatus.PENDING)
          throw new ConflictException('Order is not pending');
        const seatOrdersInTx = await this.seatOrderModel
          .find({ orderId: orderObjectId })
          .session(session)
          .lean()
          .exec();
        const seatIds = seatOrdersInTx.map(({ seatShowtimeId }) =>
          seatShowtimeId.toString(),
        );
        if (seatIds.length > 0) {
          await this.showtimeBookingService.confirmSeats(seatIds, session);
          await this.ticketContract.createTicketsForOrder(
            { orderId, seatShowtimeIds: seatIds },
            session,
          );
        }
        const productsInTx = await this.productOrderModel
          .find({ orderId: orderObjectId })
          .session(session)
          .lean()
          .exec();
        if (productsInTx.length)
          await this.productContract.deductConcessionStock(
            productsInTx.map(({ productId, quantity }) => ({
              productId: productId.toString(),
              quantity,
            })),
            session,
          );
        const update = await this.orderModel
          .updateOne(
            { _id: orderObjectId, status: OrderStatus.PENDING },
            { $set: { status: OrderStatus.PAID } },
            { session },
          )
          .exec();
        if (update.modifiedCount !== 1)
          throw new ConflictException('Could not confirm order');
      });
    } finally {
      await session.endSession();
    }
    try {
      await this.internalEventBus.publish(
        new OrderPaidEvent(
          order._id.toString(),
          order.userId.toString(),
          order.branchId ? order.branchId.toString() : undefined,
          order.totalAmount,
          'VNPAY',
          new Date(),
          order.promotionId ? order.promotionId.toString() : undefined,
          order.userId.toString(),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderPaidEvent for order ${order._id.toString()}: ${(err as Error).message}`,
      );
    }
  }

  async createBookingOrder(
    userId: string,
    request: CreateBookingOrderReq,
  ): Promise<BookingSummaryRes> {
    if (
      !request.seatShowtimeIds?.length ||
      new Set(request.seatShowtimeIds).size !== request.seatShowtimeIds.length
    ) {
      throw new ConflictException(
        'Seat selection must be non-empty and unique',
      );
    }

    const reservedSeatDetails = await this.showtimeBookingService.reserveSeats(
      request.seatShowtimeIds,
    );

    if (
      reservedSeatDetails.some((seat) => seat.showtimeId !== request.showtimeId)
    ) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      throw new ConflictException(
        'Selected seats do not belong to the requested showtime',
      );
    }

    const ticketSubtotal = reservedSeatDetails.reduce(
      (sum, seat) => sum + seat.basePrice,
      0,
    );

    let productSubtotal = 0;
    const bookingProducts: BookingProductRes[] = [];
    const productOrdersData: {
      orderId: Types.ObjectId;
      productId: Types.ObjectId;
      quantity: number;
      unitPrice: number;
    }[] = [];

    const orderObjectId = new Types.ObjectId();
    const orderId = orderObjectId.toString();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);

    if (request.products?.length) {
      const productIds = request.products.map((p) => p.productId);
      const productInfoMap =
        await this.productContract.getProductsByIds(productIds);

      for (const prodItem of request.products) {
        const info = productInfoMap.get(prodItem.productId);
        const unitPrice = info?.unitPrice ?? 0;
        productSubtotal += unitPrice * prodItem.quantity;
        bookingProducts.push({
          productId: prodItem.productId,
          productName: info?.productName ?? prodItem.productId,
          quantity: prodItem.quantity,
          unitPrice,
        });
        productOrdersData.push({
          orderId: orderObjectId,
          productId: Types.ObjectId.isValid(prodItem.productId)
            ? new Types.ObjectId(prodItem.productId)
            : (prodItem.productId as unknown as Types.ObjectId),
          quantity: prodItem.quantity,
          unitPrice,
        });
      }
    }

    let discountAmount = 0;
    let appliedPromotionId: string | undefined;
    let appliedPromotion: PromotionSummaryRes | undefined;

    if (request.promotionCode) {
      const originalSubtotal = ticketSubtotal + productSubtotal;
      const validationResult =
        await this.promotionContract.validatePromotionCode({
          code: request.promotionCode,
          orderAmount: originalSubtotal,
          userId,
        });

      if (!validationResult.isValid) {
        await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
        throw new BadRequestException(
          validationResult.reason || 'Mã giảm giá không hợp lệ',
        );
      }

      appliedPromotionId = validationResult.promotionId;
      discountAmount = Math.max(0, validationResult.discountAmount);
      appliedPromotion = PromotionSummaryRes.of(
        validationResult.promotionId || '',
        validationResult.promotionCode || request.promotionCode,
        validationResult.discountType || 'PERCENTAGE',
        validationResult.discountValue || 0,
        discountAmount,
      );
    }

    const totalAmount = Math.max(
      0,
      ticketSubtotal + productSubtotal - discountAmount,
    );

    const branchIdStr = reservedSeatDetails[0]?.branchId;
    const branchObjectId =
      branchIdStr && Types.ObjectId.isValid(branchIdStr)
        ? new Types.ObjectId(branchIdStr)
        : undefined;

    const promotionObjectId = appliedPromotionId
      ? Types.ObjectId.isValid(appliedPromotionId)
        ? new Types.ObjectId(appliedPromotionId)
        : (appliedPromotionId as unknown as Types.ObjectId)
      : undefined;

    const userObjectId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : (userId as unknown as Types.ObjectId);

    try {
      await this.orderModel.create({
        _id: orderObjectId,
        userId: userObjectId,
        branchId: branchObjectId,
        promotionId: promotionObjectId,
        totalAmount,
        status: OrderStatus.PENDING,
      });

      const seatOrdersData = reservedSeatDetails.map((seat) => ({
        orderId: orderObjectId,
        seatShowtimeId: Types.ObjectId.isValid(seat.seatShowtimeId)
          ? new Types.ObjectId(seat.seatShowtimeId)
          : (seat.seatShowtimeId as unknown as Types.ObjectId),
        price: seat.basePrice,
        orderAt: createdAt,
      }));

      await this.seatOrderModel.insertMany(seatOrdersData);
      if (productOrdersData.length) {
        await this.productOrderModel.insertMany(productOrdersData);
      }
    } catch (dbError) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      await this.orderModel.deleteOne({ _id: orderObjectId }).exec();
      await this.seatOrderModel.deleteMany({ orderId: orderObjectId }).exec();
      await this.productOrderModel
        .deleteMany({ orderId: orderObjectId })
        .exec();
      throw dbError;
    }

    try {
      await this.queueService.publish(
        ORDER_EXPIRATION_QUEUE,
        { orderId },
        { delayTime: ORDER_HOLD_TIMEOUT_MS },
      );
    } catch (queueError) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      await this.orderModel.deleteOne({ _id: orderObjectId }).exec();
      await this.seatOrderModel.deleteMany({ orderId: orderObjectId }).exec();
      await this.productOrderModel
        .deleteMany({ orderId: orderObjectId })
        .exec();
      throw queueError;
    }

    const event = new OrderCreatedEvent(
      orderId,
      userId,
      totalAmount,
      expiresAt,
      request.seatShowtimeIds,
    );
    try {
      await this.internalEventBus.publish(event);
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderCreatedEvent for order ${orderId}: ${(err as Error)?.message}`,
      );
    }

    const bookingSeats: BookingSeatRes[] = reservedSeatDetails.map((seat) => ({
      seatShowtimeId: seat.seatShowtimeId,
      seatId: seat.seatId,
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      seatType: String(seat.seatType),
      price: seat.basePrice,
    }));

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    return {
      orderId,
      userId,
      status: OrderStatus.PENDING,
      totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      seats: bookingSeats,
      products: bookingProducts,
      promotion: appliedPromotion,
    };
  }

  async getBookingSummary(
    userId: string,
    orderId: string,
  ): Promise<BookingSummaryRes> {
    const orderQuery = this.findOrderById(orderId);
    const order =
      typeof orderQuery.lean === 'function'
        ? await orderQuery.lean().exec()
        : await orderQuery.exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const [seatOrders, productOrders] = await Promise.all([
      this.seatOrderModel.find({ orderId: orderObjectId }).lean().exec(),
      this.productOrderModel.find({ orderId: orderObjectId }).lean().exec(),
    ]);

    const seatShowtimeIds = seatOrders.map((s) => s.seatShowtimeId.toString());
    const seatDetails = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const bookingSeats: BookingSeatRes[] = seatDetails.map((seat) => {
      const matchedOrder = seatOrders.find(
        (so) => so.seatShowtimeId.toString() === seat.seatShowtimeId,
      );
      return {
        seatShowtimeId: seat.seatShowtimeId,
        seatId: seat.seatId,
        rowPosition: seat.rowPosition,
        columnPosition: seat.columnPosition,
        seatType: String(seat.seatType),
        price: matchedOrder?.price ?? seat.basePrice,
      };
    });

    const productIds = productOrders.map((po) => po.productId.toString());
    const productInfoMap = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) => {
      const pIdStr = po.productId.toString();
      return {
        productId: pIdStr,
        productName: productInfoMap.get(pIdStr)?.productName ?? pIdStr,
        quantity: po.quantity,
        unitPrice: po.unitPrice,
      };
    });

    const createdAt =
      (order as unknown as { createdAt?: Date }).createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    const remainingSeconds =
      order.status === OrderStatus.PENDING
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : 0;

    let promotion: PromotionSummaryRes | undefined;
    if (order.promotionId) {
      try {
        const promoInfo = await this.promotionContract.getPromotionById(
          order.promotionId.toString(),
        );
        if (promoInfo) {
          const ticketSubtotal = bookingSeats.reduce(
            (sum, s) => sum + s.price,
            0,
          );
          const productSubtotal = bookingProducts.reduce(
            (sum, p) => sum + p.quantity * p.unitPrice,
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
      } catch {
        // ignore promotion retrieval error
      }
    }

    return {
      orderId: this.getOrderId(order),
      userId: order.userId.toString(),
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      seats: bookingSeats,
      products: bookingProducts,
      promotion,
    };
  }

  async applyPromotion(
    userId: string,
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<BookingSummaryRes> {
    const order = await this.findOrderById(orderId).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Promotion can only be applied to pending orders',
      );
    }

    const createdAt =
      (order as unknown as { createdAt?: Date }).createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    if (Date.now() > expiresAt.getTime()) {
      throw new BadRequestException('Order hold duration has expired');
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const [seatOrders, productOrders] = await Promise.all([
      this.seatOrderModel.find({ orderId: orderObjectId }).lean().exec(),
      this.productOrderModel.find({ orderId: orderObjectId }).lean().exec(),
    ]);

    const ticketSubtotal = seatOrders.reduce((sum, s) => sum + s.price, 0);
    const productSubtotal = productOrders.reduce(
      (sum, p) => sum + p.quantity * p.unitPrice,
      0,
    );
    const originalSubtotal = ticketSubtotal + productSubtotal;
    const baseAmount =
      originalSubtotal > 0 ? originalSubtotal : order.totalAmount;

    const validationResult = await this.promotionContract.validatePromotionCode(
      {
        code: request.promotionCode,
        orderAmount: baseAmount,
        userId,
      },
    );

    if (!validationResult.isValid) {
      throw new BadRequestException(
        validationResult.reason || 'Invalid promotion code',
      );
    }

    const discountAmount = Math.max(0, validationResult.discountAmount);
    const finalAmount = Math.max(0, baseAmount - discountAmount);

    if (
      validationResult.promotionId &&
      Types.ObjectId.isValid(validationResult.promotionId)
    ) {
      order.promotionId = new Types.ObjectId(validationResult.promotionId);
    }
    order.totalAmount = finalAmount;
    await order.save();

    const seatShowtimeIds = seatOrders.map((s) => s.seatShowtimeId.toString());
    const seatDetails = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const bookingSeats: BookingSeatRes[] = seatDetails.map((seat) => {
      const matchedOrder = seatOrders.find(
        (so) => so.seatShowtimeId.toString() === seat.seatShowtimeId,
      );
      return {
        seatShowtimeId: seat.seatShowtimeId,
        seatId: seat.seatId,
        rowPosition: seat.rowPosition,
        columnPosition: seat.columnPosition,
        seatType: String(seat.seatType),
        price: matchedOrder?.price ?? seat.basePrice,
      };
    });

    const productIds = productOrders.map((po) => po.productId.toString());
    const productInfoMap = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) => {
      const pIdStr = po.productId.toString();
      return {
        productId: pIdStr,
        productName: productInfoMap.get(pIdStr)?.productName ?? pIdStr,
        quantity: po.quantity,
        unitPrice: po.unitPrice,
      };
    });

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    const promotion = PromotionSummaryRes.of(
      validationResult.promotionId || '',
      validationResult.promotionCode || request.promotionCode,
      validationResult.discountType || 'PERCENTAGE',
      validationResult.discountValue || 0,
      discountAmount,
    );

    return {
      orderId: this.getOrderId(order),
      userId: order.userId.toString(),
      status: order.status,
      totalAmount: finalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      seats: bookingSeats,
      products: bookingProducts,
      promotion,
    };
  }

  async expireOrder(orderId: string): Promise<boolean> {
    const orderObjectId = this.toOrderObjectId(orderId);
    const expireFilter = Types.ObjectId.isValid(orderId)
      ? {
          $or: [{ _id: orderObjectId }, { orderId }],
          status: OrderStatus.PENDING,
        }
      : { orderId, status: OrderStatus.PENDING };

    const updateQuery = this.orderModel.findOneAndUpdate(
      expireFilter,
      { $set: { status: OrderStatus.EXPIRED } },
      { new: true },
    );
    const updatedOrder =
      typeof updateQuery.lean === 'function'
        ? await updateQuery.lean().exec()
        : await updateQuery.exec();

    if (!updatedOrder) {
      return false;
    }

    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .lean()
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );

    if (seatShowtimeIds.length > 0) {
      await this.showtimeBookingService.releaseSeats(seatShowtimeIds);
    }

    try {
      await this.internalEventBus.publish(
        new OrderExpiredEvent(orderId, seatShowtimeIds, new Date()),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderExpiredEvent for order ${orderId}: ${(err as Error)?.message}`,
      );
    }

    return true;
  }

  async getMyOrderHistory(
    userId: string,
    query: QueryMyOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const userObjectId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;
    const filter: Record<string, unknown> = { userId: userObjectId };
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    return this.paginateOrders(filter, query.page, query.limit);
  }

  async queryStaffOrders(
    query: QueryStaffOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
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
      filter.userId = Types.ObjectId.isValid(query.userId)
        ? new Types.ObjectId(query.userId)
        : query.userId;
    }
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
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
    const orderQuery = this.findOrderById(orderId);
    const order =
      typeof orderQuery.lean === 'function'
        ? await orderQuery.lean().exec()
        : await orderQuery.exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const [ticketsFromContract, productOrders] = await Promise.all([
      this.ticketContract.getTicketsByOrderId(orderId),
      this.productOrderModel.find({ orderId: orderObjectId }).lean().exec(),
    ]);

    let tickets: OrderItemTicketRes[] = ticketsFromContract.map((t) =>
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
        t.endTime,
        t.branchId,
        t.branchName,
        t.branchAddress,
      ),
    );

    if (tickets.length === 0) {
      const seatOrders = await this.seatOrderModel
        .find({ orderId: orderObjectId })
        .lean()
        .exec();
      if (seatOrders.length > 0) {
        const seatShowtimeIds = seatOrders.map((so) =>
          so.seatShowtimeId.toString(),
        );
        const seatBookingDetails =
          await this.showtimeBookingService.getSeatBookingDetails(
            seatShowtimeIds,
          );
        tickets = seatBookingDetails.map((seat) => {
          const matchedOrder = seatOrders.find(
            (so) => so.seatShowtimeId.toString() === seat.seatShowtimeId,
          );
          return OrderItemTicketRes.of(
            seat.seatShowtimeId,
            '',
            matchedOrder?.price ?? seat.basePrice,
            String(order.status),
            undefined,
            seat.movieName,
            seat.roomName,
            `${seat.rowPosition}${seat.columnPosition}`,
            seat.startTime,
            seat.endTime,
            seat.branchId,
          );
        });
      }
    }

    const branchId =
      tickets[0]?.branchId ||
      (order.branchId ? order.branchId.toString() : undefined);
    let branchName = tickets[0]?.branchName;
    const branchAddress = tickets[0]?.branchAddress;

    if (branchId && (!branchName || !branchAddress)) {
      const branchSummary =
        await this.branchQueryService.getBranchSummary(branchId);
      if (branchSummary) {
        branchName = branchName || branchSummary.branchName;
      }
    }

    const productIds = productOrders.map((po) => po.productId.toString());
    const productsMap =
      productIds.length > 0
        ? await this.productContract.getProductsByIds(productIds)
        : new Map<string, ProductSummaryDto>();

    const products: OrderItemProductRes[] = productOrders.map((po) => {
      const pIdStr = po.productId.toString();
      const prodInfo = productsMap.get(pIdStr);
      return OrderItemProductRes.of(
        pIdStr,
        prodInfo?.productName ?? pIdStr,
        prodInfo?.imageUrl,
        po.quantity,
        po.unitPrice,
        po.quantity * po.unitPrice,
      );
    });

    let promotion: PromotionSummaryRes | undefined;
    if (order.promotionId) {
      const promoInfo = await this.promotionContract.getPromotionById(
        order.promotionId.toString(),
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
      this.getOrderId(order),
      order.userId.toString(),
      order.totalAmount,
      order.status,
      (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
      tickets,
      products,
      promotion,
      branchId,
      branchName,
      branchAddress,
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

    const orderObjectIds = orders
      .map((o) => (o as { _id?: Types.ObjectId })._id)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const orderFallbackIds = orders.map((o) => this.getOrderId(o));

    const [seatOrders, productOrders] = await Promise.all([
      this.seatOrderModel
        .find({
          $or: [
            { orderId: { $in: orderObjectIds } },
            { orderId: { $in: orderFallbackIds } },
          ],
        })
        .lean()
        .exec(),
      this.productOrderModel
        .find({
          $or: [
            { orderId: { $in: orderObjectIds } },
            { orderId: { $in: orderFallbackIds } },
          ],
        })
        .lean()
        .exec(),
    ]);

    const ticketCountMap = new Map<string, number>();
    for (const so of seatOrders) {
      const orderIdStr = so.orderId.toString();
      ticketCountMap.set(orderIdStr, (ticketCountMap.get(orderIdStr) ?? 0) + 1);
    }

    const hasProductsMap = new Set<string>();
    for (const po of productOrders) {
      hasProductsMap.add(po.orderId.toString());
    }

    const branchIds = Array.from(
      new Set(
        orders
          .map((o) => (o.branchId ? o.branchId.toString() : undefined))
          .filter(Boolean),
      ),
    ) as string[];
    const branchNameMap = new Map<string, string>();
    if (branchIds.length > 0) {
      await Promise.all(
        branchIds.map(async (bId) => {
          const summary = await this.branchQueryService.getBranchSummary(bId);
          if (summary) {
            branchNameMap.set(bId, summary.branchName);
          }
        }),
      );
    }

    const items: OrderSummaryRes[] = orders.map((o) => {
      const orderIdStr = this.getOrderId(o);
      const bId = o.branchId ? o.branchId.toString() : undefined;
      return OrderSummaryRes.of(
        orderIdStr,
        o.userId.toString(),
        o.totalAmount,
        o.status,
        (o as unknown as { createdAt?: Date }).createdAt ?? new Date(),
        ticketCountMap.get(orderIdStr) ?? 0,
        hasProductsMap.has(orderIdStr),
        bId,
        bId ? branchNameMap.get(bId) : undefined,
      );
    });

    return Page.from(items, total, page, limit);
  }

  async cancelOrder(
    orderId: string,
    actor: { userId: string; role: string; branchId?: string },
    reason?: string,
  ): Promise<CancelOrderRes> {
    const order = await this.findOrderById(orderId).exec();
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${orderId}`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán (PENDING)',
      );
    }

    if (actor.role === Role.USER || actor.role === 'CUSTOMER') {
      if (order.userId.toString() !== actor.userId) {
        throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này');
      }
    } else if (actor.role === Role.STAFF) {
      let orderBranchId = order.branchId
        ? order.branchId.toString()
        : undefined;
      if (!orderBranchId) {
        const orderObjectId = this.toOrderObjectId(orderId);
        const seatOrders = await this.seatOrderModel
          .find({ orderId: orderObjectId })
          .lean()
          .exec();
        const seatShowtimeIds = seatOrders.map((so) =>
          so.seatShowtimeId.toString(),
        );
        if (seatShowtimeIds.length) {
          const seatDetails =
            await this.showtimeBookingService.getSeatBookingDetails(
              seatShowtimeIds,
            );
          orderBranchId = seatDetails[0]?.branchId;
        }
      }
      if (orderBranchId && actor.branchId && orderBranchId !== actor.branchId) {
        throw new ForbiddenException(
          'Đơn hàng không thuộc chi nhánh của nhân viên',
        );
      }
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .lean()
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );

    if (seatShowtimeIds.length > 0) {
      await this.showtimeBookingService.releaseSeats(seatShowtimeIds);
    }

    order.status = OrderStatus.CANCELLED;
    await order.save();

    const cancelledAt = new Date();
    try {
      await this.internalEventBus.publish(
        new OrderCancelledEvent(
          orderId,
          actor.userId,
          seatShowtimeIds,
          reason || 'Hủy đơn hàng',
          cancelledAt,
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderCancelledEvent for order ${orderId}: ${(err as Error)?.message}`,
      );
    }

    return CancelOrderRes.of(
      orderId,
      OrderStatus.CANCELLED,
      'Đã hủy đơn hàng thành công',
      cancelledAt,
    );
  }
}
