import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Page } from '../../../../common/dto/page.dto';
import { OrderStatus } from '@prisma/client';
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
    private readonly prisma: PrismaService,
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

  async createVnpayPayment(userId: string, orderId: string, ipAddr: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    if (order.userId !== userId)
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }
    if (order.status === OrderStatus.PAID)
      return { RspCode: '00', Message: 'Confirm Success' };
    if (order.status !== OrderStatus.PENDING)
      return { RspCode: '02', Message: 'Order not pending' };

    await this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (currentOrder?.status === OrderStatus.PAID) return;
      if (!currentOrder || currentOrder.status !== OrderStatus.PENDING)
        throw new ConflictException('Order is not pending');

      const seatOrdersInTx = await tx.seatOrder.findMany({
        where: { orderId },
      });
      const seatIds = seatOrdersInTx.map(({ seatShowtimeId }) => seatShowtimeId);
      if (seatIds.length > 0) {
        await this.showtimeBookingService.confirmSeats(seatIds, tx);
        await this.ticketContract.createTicketsForOrder(
          { orderId, seatShowtimeIds: seatIds },
          tx,
        );
      }

      const productsInTx = await tx.productOrder.findMany({
        where: { orderId },
      });
      if (productsInTx.length) {
        await this.productContract.deductConcessionStock(
          productsInTx.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
          tx,
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
    });

    try {
      await this.internalEventBus.publish(
        new OrderPaidEvent(
          order.id,
          order.userId,
          undefined,
          order.totalAmount,
          'VNPAY',
          new Date(),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderPaidEvent for order ${order.id}: ${(err as Error).message}`,
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
      productId: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

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
          productId: prodItem.productId,
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

    let orderId = '';
    try {
      const createdOrder = await this.prisma.order.create({
        data: {
          userId,
          branchId: reservedSeatDetails[0]?.branchId,
          promotionId: appliedPromotionId,
          totalAmount,
          status: OrderStatus.PENDING,
          seatOrders: {
            create: reservedSeatDetails.map((seat) => ({
              seatShowtimeId: seat.seatShowtimeId,
              price: seat.basePrice,
              orderAt: createdAt,
            })),
          },
          ...(productOrdersData.length > 0
            ? {
                productOrders: {
                  create: productOrdersData.map((po) => ({
                    productId: po.productId,
                    quantity: po.quantity,
                    unitPrice: po.unitPrice,
                  })),
                },
              }
            : {}),
        },
      });
      orderId = createdOrder.id;
    } catch (dbError) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
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
      await this.prisma.seatOrder.deleteMany({ where: { orderId } });
      await this.prisma.productOrder.deleteMany({ where: { orderId } });
      await this.prisma.order.delete({ where: { id: orderId } });
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
      status: OrderStatus.PENDING as any,
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
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const [seatOrders, productOrders] = await Promise.all([
      this.prisma.seatOrder.findMany({ where: { orderId } }),
      this.prisma.productOrder.findMany({ where: { orderId } }),
    ]);

    const seatShowtimeIds = seatOrders.map((s) => s.seatShowtimeId);
    const seatDetails = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const bookingSeats: BookingSeatRes[] = seatDetails.map((seat) => {
      const matchedOrder = seatOrders.find(
        (so) => so.seatShowtimeId === seat.seatShowtimeId,
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

    const productIds = productOrders.map((po) => po.productId);
    const productInfoMap = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) => ({
      productId: po.productId,
      productName:
        productInfoMap.get(po.productId)?.productName ?? po.productId,
      quantity: po.quantity,
      unitPrice: po.unitPrice,
    }));

    const createdAt = order.createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    const remainingSeconds =
      order.status === OrderStatus.PENDING
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : 0;

    let promotion: PromotionSummaryRes | undefined;
    if (order.promotionId) {
      try {
        const promoInfo = await this.promotionContract.getPromotionById(
          order.promotionId,
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
      orderId: order.id,
      userId: order.userId,
      status: order.status as any,
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
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Promotion can only be applied to pending orders',
      );
    }

    const createdAt = order.createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    if (Date.now() > expiresAt.getTime()) {
      throw new BadRequestException('Order hold duration has expired');
    }

    const [seatOrders, productOrders] = await Promise.all([
      this.prisma.seatOrder.findMany({ where: { orderId } }),
      this.prisma.productOrder.findMany({ where: { orderId } }),
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

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        promotionId: validationResult.promotionId,
        totalAmount: finalAmount,
      },
    });

    const seatShowtimeIds = seatOrders.map((s) => s.seatShowtimeId);
    const seatDetails = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const bookingSeats: BookingSeatRes[] = seatDetails.map((seat) => {
      const matchedOrder = seatOrders.find(
        (so) => so.seatShowtimeId === seat.seatShowtimeId,
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

    const productIds = productOrders.map((po) => po.productId);
    const productInfoMap = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) => ({
      productId: po.productId,
      productName:
        productInfoMap.get(po.productId)?.productName ?? po.productId,
      quantity: po.quantity,
      unitPrice: po.unitPrice,
    }));

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
      orderId: order.id,
      userId: order.userId,
      status: order.status as any,
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
    const updated = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.EXPIRED },
    });

    if (updated.count === 0) {
      return false;
    }

    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

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
    const where: any = { userId };
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean) as OrderStatus[];
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    return this.paginateOrders(where, query.page, query.limit);
  }

  async queryStaffOrders(
    query: QueryStaffOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const where: any = {};
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean) as OrderStatus[];
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }
    if (query.date) {
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    return this.paginateOrders(where, query.page, query.limit);
  }

  async queryAdminOrders(
    query: QueryAdminOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const where: any = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.status) {
      const statuses = query.status.split(',').filter(Boolean) as OrderStatus[];
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }
    if (query.fromDate || query.toDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.fromDate) {
        dateFilter.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        dateFilter.lte = new Date(query.toDate);
      }
      where.createdAt = dateFilter;
    }

    return this.paginateOrders(where, query.page, query.limit);
  }

  async getOrderDetail(orderId: string): Promise<OrderDetailRes> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const [ticketsFromContract, productOrders] = await Promise.all([
      this.ticketContract.getTicketsByOrderId(orderId),
      this.prisma.productOrder.findMany({ where: { orderId } }),
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
      const seatOrders = await this.prisma.seatOrder.findMany({
        where: { orderId },
      });
      if (seatOrders.length > 0) {
        const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);
        const seatBookingDetails =
          await this.showtimeBookingService.getSeatBookingDetails(
            seatShowtimeIds,
          );
        tickets = seatBookingDetails.map((seat) => {
          const matchedOrder = seatOrders.find(
            (so) => so.seatShowtimeId === seat.seatShowtimeId,
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

    const branchId = tickets[0]?.branchId || order.branchId;
    let branchName = tickets[0]?.branchName;
    const branchAddress = tickets[0]?.branchAddress;

    if (branchId && (!branchName || !branchAddress)) {
      const branchSummary =
        await this.branchQueryService.getBranchSummary(branchId);
      if (branchSummary) {
        branchName = branchName || branchSummary.branchName;
      }
    }

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
      order.id,
      order.userId,
      order.totalAmount,
      order.status as any,
      order.createdAt ?? new Date(),
      tickets,
      products,
      promotion,
      branchId ?? undefined,
      branchName,
      branchAddress,
    );
  }

  private async paginateOrders(
    where: any,
    page: number = 1,
    limit: number = 10,
  ): Promise<Page<OrderSummaryRes>> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    const orderIds = orders.map((o) => o.id);

    const [seatOrders, productOrders] = await Promise.all([
      this.prisma.seatOrder.findMany({
        where: { orderId: { in: orderIds } },
      }),
      this.prisma.productOrder.findMany({
        where: { orderId: { in: orderIds } },
      }),
    ]);

    const ticketCountMap = new Map<string, number>();
    for (const so of seatOrders) {
      ticketCountMap.set(so.orderId, (ticketCountMap.get(so.orderId) ?? 0) + 1);
    }

    const hasProductsMap = new Set<string>();
    for (const po of productOrders) {
      hasProductsMap.add(po.orderId);
    }

    const branchIds = Array.from(
      new Set(orders.map((o) => o.branchId).filter(Boolean)),
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
      const bId = o.branchId ?? undefined;
      return OrderSummaryRes.of(
        o.id,
        o.userId,
        o.totalAmount,
        o.status as any,
        o.createdAt ?? new Date(),
        ticketCountMap.get(o.id) ?? 0,
        hasProductsMap.has(o.id),
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${orderId}`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán (PENDING)',
      );
    }

    if (actor.role === Role.USER || actor.role === 'CUSTOMER') {
      if (order.userId !== actor.userId) {
        throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này');
      }
    } else if (actor.role === Role.STAFF) {
      let orderBranchId: string | null | undefined = order.branchId;
      if (!orderBranchId) {
        const seatOrders = await this.prisma.seatOrder.findMany({
          where: { orderId },
        });
        const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);
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

    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

    if (seatShowtimeIds.length > 0) {
      await this.showtimeBookingService.releaseSeats(seatShowtimeIds);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

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
      OrderStatus.CANCELLED as any,
      'Đã hủy đơn hàng thành công',
      cancelledAt,
    );
  }
}
