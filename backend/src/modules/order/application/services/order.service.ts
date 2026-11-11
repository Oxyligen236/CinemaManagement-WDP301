import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Page } from '../../../../common/dto/page.dto';
import { OrderStatus } from '@prisma/client';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { TicketScannedEvent } from '../../domain/events/ticket-scanned.event';
import {
  ORDER_BOOKING_MESSAGES,
  ORDER_EXPIRATION_QUEUE,
  ORDER_HOLD_TIMEOUT_MS,
} from '../../domain/constants/order.constant';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';
import { OrderExpiredEvent } from '../../domain/events/order-expired.event';
import { OrderPaidEvent } from '../../domain/events/order-paid.event';
import { OrderCancelledEvent } from '../../domain/events/order-cancelled.event';
import { Role } from '../../../auth/infra/decorators/role.decorator';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { PaymentService } from '../../../payment/application/services/payment.service';
import { ShowtimeBookingService } from '../../../showtime/application/services/showtime-booking.service';
import { ProductService } from '../../../product/application/services/product.service';
import { ProductSummaryRes } from '../../../product/application/dto/res.dto';
import { PromotionPublicService } from '../../../promotion/application/services/promotion-public.service';
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
  CancelPosOrderReq,
  CreateBookingOrderReq,
  CreatePosOrderReq,
  QueryAdminOrdersReq,
  QueryMyOrdersReq,
  QueryStaffOrdersReq,
  ScanTicketReq,
  StaffScanContextReq,
} from '../dto/req.dto';
import {
  ApplyPromotionRes,
  BookingProductRes,
  BookingSeatRes,
  BookingSummaryRes,
  CancelOrderRes,
  OrderDetailRes,
  OrderItemProductRes,
  OrderItemTicketRes,
  OrderPaymentInfoDto,
  OrderPaymentTicketDto,
  OrderSummaryRes,
  PosBookingSummaryRes,
  PosReceiptItemRes,
  PosReceiptRes,
  PosReceiptSeatRes,
  PosReceiptTicketRes,
  PromotionSummaryRes,
  ScanTicketResultRes,
  TicketDetailRes,
  TicketItemSummaryRes,
} from '../dto/res.dto';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly showtimeBookingService: ShowtimeBookingService,
    private readonly productService: ProductService,
    private readonly promotionPublicService: PromotionPublicService,
    @Inject(QUEUE_SERVICE)
    private readonly queueService: QueueService,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly internalEventBus: InternalEventBus,
    private readonly branchQueryService: BranchQueryService,
  ) {}

  async getOrderForOnlinePayment(
    userId: string,
    orderId: string,
  ): Promise<{ orderId: string; totalAmount: number }> {
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
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }
    return { orderId: order.id, totalAmount: order.totalAmount };
  }

  async getOrderForPosPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
  ): Promise<OrderPaymentInfoDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    return {
      orderId: order.id,
      userId: order.userId,
      branchId: order.branchId,
      totalAmount: order.totalAmount,
      status: order.status,
      updatedAt: order.updatedAt,
    };
  }

  async getPaidOrderTickets(orderId: string): Promise<OrderPaymentTicketDto[]> {
    return this.getTicketsByOrderId(orderId);
  }

  async fulfillOrderPayment(
    orderId: string,
    paymentId?: string,
    paymentContext?: {
      paymentMethod?: string;
      branchId?: string;
      staffId?: string;
    },
  ): Promise<{ tickets: OrderPaymentTicketDto[]; paidAt: Date }> {
    return this.fulfillOrder(orderId, paymentId, paymentContext);
  }

  async fulfillVnpayOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }
    if (order.status === OrderStatus.PAID)
      return { RspCode: '00', Message: 'Confirm Success' };
    if (order.status !== OrderStatus.PENDING)
      return { RspCode: '02', Message: 'Order not pending' };

    await this.fulfillOrder(orderId, undefined, { paymentMethod: 'VNPAY' });
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  private async fulfillOrder(
    orderId: string,
    paymentId?: string,
    paymentContext?: {
      paymentMethod?: string;
      branchId?: string;
      staffId?: string;
    },
  ): Promise<{ tickets: TicketItemSummaryRes[]; paidAt: Date }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      const tickets = await this.getTicketsByOrderId(orderId);
      return {
        tickets,
        paidAt: order.updatedAt ?? new Date(),
      };
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Đơn hàng không ở trạng thái chờ thanh toán');
    }

    let createdTickets: TicketItemSummaryRes[] = [];
    await this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (currentOrder?.status === OrderStatus.PAID) return;
      if (!currentOrder || currentOrder.status !== OrderStatus.PENDING) {
        throw new ConflictException('Order is not pending');
      }

      const seatOrdersInTx = await tx.seatOrder.findMany({
        where: { orderId },
      });
      const seatIds = seatOrdersInTx.map(
        ({ seatShowtimeId }) => seatShowtimeId,
      );
      if (seatIds.length > 0) {
        await this.showtimeBookingService.confirmSeats(seatIds, tx);
        createdTickets = await this.createTicketsForOrder(
          { orderId, seatShowtimeIds: seatIds },
          tx,
        );
      }

      const productsInTx = await tx.productOrder.findMany({
        where: { orderId },
      });
      if (productsInTx.length) {
        await this.productService.deductConcessionStock(
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

    const paidAt = new Date();
    const paymentMethod =
      paymentContext?.paymentMethod || (paymentId ? 'QR' : 'VNPAY');
    const actorId = paymentContext?.staffId || order.userId;
    const branchId = paymentContext?.branchId || order.branchId || undefined;

    try {
      await this.internalEventBus.publish(
        new OrderPaidEvent(
          order.id,
          actorId,
          branchId,
          order.totalAmount,
          paymentMethod,
          paidAt,
          order.promotionId ?? undefined,
          order.userId,
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderPaidEvent for order ${order.id}: ${(err as Error).message}`,
      );
    }

    if (createdTickets.length === 0) {
      createdTickets = await this.getTicketsByOrderId(orderId);
    }

    return { tickets: createdTickets, paidAt };
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
      reservedSeatDetails.some(
        (s) => s.startTime && new Date(s.startTime).getTime() <= Date.now(),
      )
    ) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      throw new BadRequestException(
        ORDER_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING,
      );
    }

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
        await this.productService.getProductsByIds(productIds);

      for (const prodItem of request.products) {
        const info = productInfoMap.get(prodItem.productId);
        const unitPrice = info?.unitPrice ?? 0;
        productSubtotal += unitPrice * prodItem.quantity;
        bookingProducts.push(
          BookingProductRes.of(
            prodItem.productId,
            info?.productName ?? prodItem.productId,
            prodItem.quantity,
            unitPrice,
          ),
        );
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
        await this.promotionPublicService.validatePromotionCode({
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

    const bookingSeats: BookingSeatRes[] = reservedSeatDetails.map((seat) =>
      BookingSeatRes.of(
        seat.seatShowtimeId,
        seat.seatId,
        seat.rowPosition,
        seat.columnPosition,
        String(seat.seatType),
        seat.basePrice,
      ),
    );

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    return BookingSummaryRes.of(
      orderId,
      userId,
      OrderStatus.PENDING as any,
      totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      bookingSeats,
      bookingProducts,
      appliedPromotion,
    );
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
      return BookingSeatRes.of(
        seat.seatShowtimeId,
        seat.seatId,
        seat.rowPosition,
        seat.columnPosition,
        String(seat.seatType),
        matchedOrder?.price ?? seat.basePrice,
      );
    });

    const productIds = productOrders.map((po) => po.productId);
    const productInfoMap = productIds.length
      ? await this.productService.getProductsByIds(productIds)
      : new Map<string, ProductSummaryRes>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) =>
      BookingProductRes.of(
        po.productId,
        productInfoMap.get(po.productId)?.productName ?? po.productId,
        po.quantity,
        po.unitPrice,
      ),
    );

    const createdAt = order.createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    const remainingSeconds =
      order.status === OrderStatus.PENDING
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : 0;

    let promotion: PromotionSummaryRes | undefined;
    if (order.promotionId) {
      try {
        const promoInfo = await this.promotionPublicService.getPromotionById(
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

    return BookingSummaryRes.of(
      order.id,
      order.userId,
      order.status as any,
      order.totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      bookingSeats,
      bookingProducts,
      promotion,
    );
  }

  async applyPromotion(
    userId: string,
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<ApplyPromotionRes> {
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

    const validationResult =
      await this.promotionPublicService.validatePromotionCode({
        code: request.promotionCode,
        orderAmount: baseAmount,
        userId,
      });

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
      return BookingSeatRes.of(
        seat.seatShowtimeId,
        seat.seatId,
        seat.rowPosition,
        seat.columnPosition,
        String(seat.seatType),
        matchedOrder?.price ?? seat.basePrice,
      );
    });

    const productIds = productOrders.map((po) => po.productId);
    const productInfoMap = productIds.length
      ? await this.productService.getProductsByIds(productIds)
      : new Map<string, ProductSummaryRes>();

    const bookingProducts: BookingProductRes[] = productOrders.map((po) =>
      BookingProductRes.of(
        po.productId,
        productInfoMap.get(po.productId)?.productName ?? po.productId,
        po.quantity,
        po.unitPrice,
      ),
    );

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

    return ApplyPromotionRes.of(
      order.id,
      order.userId,
      order.status as any,
      finalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      bookingSeats,
      bookingProducts,
      promotion,
    );
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

    const [paidTickets, productOrders] = await Promise.all([
      this.getTicketsByOrderId(orderId),
      this.prisma.productOrder.findMany({ where: { orderId } }),
    ]);

    let tickets: OrderItemTicketRes[] = paidTickets.map((t) =>
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
        ? await this.productService.getProductsByIds(productIds)
        : new Map<string, ProductSummaryRes>();

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
      const promoInfo = await this.promotionPublicService.getPromotionById(
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
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${orderId}`);
    }

    if (order.status === OrderStatus.EXPIRED) {
      throw new BadRequestException(
        'Đơn hàng đã hết hạn giữ chỗ (10 phút), không thể hủy',
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng đã được hủy trước đó');
    }
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException(
        'Đơn hàng đã thanh toán thành công, không thể hủy',
      );
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán (PENDING)',
      );
    }

    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    if (elapsedMs > ORDER_HOLD_TIMEOUT_MS) {
      await this.expireOrder(orderId);
      throw new BadRequestException(
        'Đơn hàng đã hết hạn giữ chỗ (10 phút), không thể hủy',
      );
    }

    if (actor.role === (Role.USER as string) || actor.role === 'CUSTOMER') {
      if (order.userId !== actor.userId) {
        throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này');
      }
    } else if (actor.role === (Role.STAFF as string)) {
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

  async createPosBookingOrder(
    staffContext: { staffId: string; branchId: string },
    request: CreatePosOrderReq,
  ): Promise<PosBookingSummaryRes> {
    const hasSeats = Boolean(request.seatShowtimeIds?.length);
    const hasProducts = Boolean(request.products?.length);

    if (!hasSeats && !hasProducts) {
      throw new BadRequestException(
        'Đơn hàng phải có ít nhất ghế hoặc sản phẩm F&B',
      );
    }

    const reservedSeats = hasSeats
      ? await this.showtimeBookingService.reserveSeats(request.seatShowtimeIds!)
      : [];

    if (
      reservedSeats.some(
        (s) => s.startTime && new Date(s.startTime).getTime() <= Date.now(),
      )
    ) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds!);
      throw new BadRequestException(
        ORDER_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING,
      );
    }

    if (
      reservedSeats.some(
        (seat) => seat.branchId && seat.branchId !== staffContext.branchId,
      )
    ) {
      if (hasSeats) {
        await this.showtimeBookingService.releaseSeats(
          request.seatShowtimeIds!,
        );
      }
      throw new ForbiddenException(
        'Suất chiếu không thuộc chi nhánh của nhân viên',
      );
    }

    const productIds = request.products?.map((p) => p.productId) ?? [];
    const productsMap: Map<string, ProductSummaryRes> = productIds.length
      ? await this.productService.getProductsByIds(productIds)
      : new Map<string, ProductSummaryRes>();

    if (request.products?.length) {
      for (const item of request.products) {
        const prod = productsMap.get(item.productId);
        if (!prod) {
          if (hasSeats) {
            await this.showtimeBookingService.releaseSeats(
              request.seatShowtimeIds!,
            );
          }
          throw new NotFoundException(
            `Sản phẩm F&B ${item.productId} không tồn tại`,
          );
        }
        if (prod.branchId && prod.branchId !== staffContext.branchId) {
          if (hasSeats) {
            await this.showtimeBookingService.releaseSeats(
              request.seatShowtimeIds!,
            );
          }
          throw new ForbiddenException(
            'Sản phẩm F&B không thuộc chi nhánh của nhân viên',
          );
        }
      }
    }

    const ticketSubtotal = reservedSeats.reduce(
      (sum, seat) => sum + seat.basePrice,
      0,
    );
    const productSubtotal = (request.products ?? []).reduce((sum, item) => {
      const prod = productsMap.get(item.productId);
      return sum + item.quantity * (prod?.unitPrice ?? 0);
    }, 0);
    const totalAmount = ticketSubtotal + productSubtotal;

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    let orderId = '';

    try {
      const created = await this.prisma.order.create({
        data: {
          userId: staffContext.staffId,
          branchId: staffContext.branchId,
          totalAmount,
          status: OrderStatus.PENDING,
          ...(hasSeats && reservedSeats.length > 0
            ? {
                seatOrders: {
                  create: reservedSeats.map((seat) => ({
                    seatShowtimeId: seat.seatShowtimeId,
                    price: seat.basePrice,
                    orderAt: createdAt,
                  })),
                },
              }
            : {}),
          ...(request.products?.length
            ? {
                productOrders: {
                  create: request.products.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: productsMap.get(item.productId)?.unitPrice ?? 0,
                  })),
                },
              }
            : {}),
        },
      });
      orderId = created.id;
    } catch (dbError) {
      if (hasSeats) {
        await this.showtimeBookingService.releaseSeats(
          request.seatShowtimeIds!,
        );
      }
      throw dbError;
    }

    try {
      await this.queueService.publish(
        ORDER_EXPIRATION_QUEUE,
        { orderId },
        { delayTime: ORDER_HOLD_TIMEOUT_MS },
      );
    } catch (queueError) {
      if (hasSeats) {
        await this.showtimeBookingService.releaseSeats(
          request.seatShowtimeIds!,
        );
      }
      await this.prisma.seatOrder.deleteMany({ where: { orderId } });
      await this.prisma.productOrder.deleteMany({ where: { orderId } });
      await this.prisma.order.delete({ where: { id: orderId } });
      throw queueError;
    }

    try {
      await this.internalEventBus.publish(
        new OrderCreatedEvent(
          orderId,
          staffContext.staffId,
          totalAmount,
          expiresAt,
          hasSeats ? request.seatShowtimeIds! : [],
        ),
      );
    } catch (eventError) {
      this.logger.warn(
        `Failed to publish OrderCreatedEvent for POS order ${orderId}: ${(eventError as Error)?.message}`,
      );
    }

    const seats = reservedSeats.map((s) =>
      BookingSeatRes.of(
        s.seatShowtimeId,
        s.seatId,
        s.rowPosition,
        s.columnPosition,
        s.seatType,
        s.basePrice,
      ),
    );
    const products = (request.products ?? []).map((p) => {
      const prod = productsMap.get(p.productId);
      return BookingProductRes.of(
        p.productId,
        prod?.productName ?? p.productId,
        p.quantity,
        prod?.unitPrice ?? 0,
      );
    });

    return PosBookingSummaryRes.of(
      orderId,
      staffContext.staffId,
      OrderStatus.PENDING as any,
      totalAmount,
      createdAt,
      expiresAt,
      Math.floor(ORDER_HOLD_TIMEOUT_MS / 1000),
      seats,
      products,
    );
  }

  async applyPosPromotion(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<PosBookingSummaryRes> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể áp dụng mã giảm giá cho đơn hàng đang chờ thanh toán',
      );
    }

    const validation = await this.promotionPublicService.validatePromotionCode({
      code: request.promotionCode,
      orderAmount: order.totalAmount,
      userId: order.userId,
    });

    if (!validation.isValid) {
      throw new BadRequestException(
        validation.reason || 'Mã khuyến mãi không hợp lệ',
      );
    }

    const newTotal = Math.max(0, order.totalAmount - validation.discountAmount);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        promotionId: validation.promotionId,
        totalAmount: newTotal,
      },
    });

    return this.buildPosBookingSummary(updated);
  }

  async cancelPosOrder(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request?: CancelPosOrderReq,
  ): Promise<{ success: boolean; message: string }> {
    await this.cancelOrder(
      orderId,
      {
        userId: staffContext.staffId,
        role: Role.STAFF,
        branchId: staffContext.branchId,
      },
      request?.reason || 'Hủy tại quầy',
    );
    return {
      success: true,
      message: 'Đã hủy đơn hàng và nhả ghế thành công',
    };
  }

  async getPosReceipt(
    staffContext: {
      staffId: string;
      branchId: string;
      staffName?: string;
      branchName?: string;
      branchAddress?: string;
    },
    orderId: string,
  ): Promise<PosReceiptRes> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Hóa đơn chỉ được in cho đơn hàng đã thanh toán',
      );
    }

    let paymentMethod = 'CASH';
    try {
      const paymentStatus =
        await this.paymentService.checkPaymentStatus(orderId);
      if (paymentStatus?.method) {
        paymentMethod = paymentStatus.method;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to check payment status for receipt ${orderId}: ${(err as Error)?.message}`,
      );
    }

    let tickets = await this.getTicketsByOrderId(orderId);
    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

    if (!tickets.length && seatShowtimeIds.length) {
      tickets = await this.createTicketsForOrder({
        orderId,
        seatShowtimeIds,
      });
    }

    let seatBookingMap = new Map<string, string>();
    if (seatShowtimeIds.length) {
      try {
        const seatDetails =
          await this.showtimeBookingService.getSeatBookingDetails(
            seatShowtimeIds,
          );
        seatBookingMap = new Map(
          seatDetails.map((s) => [s.seatShowtimeId, s.seatType]),
        );
      } catch (err) {
        this.logger.warn(
          `Failed to get seat booking details for receipt ${orderId}: ${(err as Error)?.message}`,
        );
      }
    }

    const firstTicket = tickets[0];
    const showtime = firstTicket?.startTime
      ? new Date(firstTicket.startTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined;
    const showDate = firstTicket?.startTime
      ? new Date(firstTicket.startTime).toLocaleDateString('vi-VN')
      : undefined;

    const productOrders = await this.prisma.productOrder.findMany({
      where: { orderId },
    });
    const productIds = productOrders.map((po) => po.productId);
    const productsMap: Map<string, ProductSummaryRes> = productIds.length
      ? await this.productService.getProductsByIds(productIds)
      : new Map<string, ProductSummaryRes>();

    let branchName =
      firstTicket?.branchName ||
      staffContext.branchName ||
      `MyCast Chi nhánh ${staffContext.branchId}`;
    let branchAddress =
      firstTicket?.branchAddress ||
      staffContext.branchAddress ||
      'Chi nhánh hệ thống rạp MyCast';

    if (
      staffContext.branchId &&
      (!firstTicket?.branchName || !firstTicket?.branchAddress)
    ) {
      try {
        const branchSummary = await this.branchQueryService.getBranchSummary(
          staffContext.branchId,
        );
        if (branchSummary) {
          branchName =
            firstTicket?.branchName ||
            staffContext.branchName ||
            branchSummary.branchName;
          branchAddress =
            firstTicket?.branchAddress ||
            staffContext.branchAddress ||
            'Chi nhánh hệ thống rạp MyCast';
        }
      } catch {
        // ignore
      }
    }

    return PosReceiptRes.of({
      orderId,
      orderCode: order.id.slice(-8).toUpperCase(),
      branchName,
      branchAddress,
      staffName: staffContext.staffName || 'Thu ngân',
      printedAt: new Date(),
      paymentMethod,
      totalAmount: order.totalAmount,
      cashReceived: paymentMethod === 'CASH' ? order.totalAmount : undefined,
      changeAmount: 0,
      movieTitle: firstTicket?.movieTitle || '',
      roomName: firstTicket?.roomName || '',
      showtime,
      showDate,
      seats: tickets.map((t) => {
        const seatType =
          (t.seatShowtimeId && seatBookingMap.get(t.seatShowtimeId)) ||
          'Tiêu chuẩn';
        return PosReceiptSeatRes.of(t.seatLabel, seatType, t.price);
      }),
      tickets: tickets.map((t) => {
        const seatType =
          (t.seatShowtimeId && seatBookingMap.get(t.seatShowtimeId)) ||
          'Tiêu chuẩn';
        return PosReceiptTicketRes.of(
          t.ticketCode,
          t.movieTitle,
          t.roomName,
          t.seatLabel,
          t.startTime,
          t.endTime,
          t.price,
          t.seatLabel,
          seatType,
        );
      }),
      products: productOrders.map((po) => {
        const prod = productsMap.get(po.productId);
        return PosReceiptItemRes.of(
          prod?.productName || po.productId,
          po.quantity,
          po.unitPrice,
          po.quantity * po.unitPrice,
        );
      }),
    });
  }

  private async verifyOrderBranch(
    orderId: string,
    branchId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (order?.branchId && order.branchId !== branchId) {
      throw new ForbiddenException(
        'Đơn hàng không thuộc chi nhánh của nhân viên',
      );
    }

    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);
    if (seatShowtimeIds.length) {
      const seats =
        await this.showtimeBookingService.getSeatBookingDetails(
          seatShowtimeIds,
        );
      if (seats.some((seat) => seat.branchId && seat.branchId !== branchId)) {
        throw new ForbiddenException(
          'Đơn hàng không thuộc chi nhánh của nhân viên',
        );
      }
    }
  }

  private async buildPosBookingSummary(
    order: any,
  ): Promise<PosBookingSummaryRes> {
    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId: order.id },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);
    const seats = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const productOrders = await this.prisma.productOrder.findMany({
      where: { orderId: order.id },
    });
    const productIds = productOrders.map((po) => po.productId);
    const productsMap: Map<string, ProductSummaryRes> = productIds.length
      ? await this.productService.getProductsByIds(productIds)
      : new Map<string, ProductSummaryRes>();

    const createdAt = order.createdAt ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    const mappedSeats = seats.map((s) =>
      BookingSeatRes.of(
        s.seatShowtimeId,
        s.seatId,
        s.rowPosition,
        s.columnPosition,
        s.seatType,
        s.basePrice,
      ),
    );
    const mappedProducts = productOrders.map((po) => {
      const prod = productsMap.get(po.productId);
      return BookingProductRes.of(
        po.productId,
        prod?.productName || po.productId,
        po.quantity,
        po.unitPrice,
      );
    });

    return PosBookingSummaryRes.of(
      order.id,
      order.userId,
      order.status,
      order.totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      mappedSeats,
      mappedProducts,
    );
  }

  async scanTicket(
    staffContextOrReq: StaffScanContextReq | ScanTicketReq,
    reqOrStaffContext?: ScanTicketReq | StaffScanContextReq,
  ): Promise<ScanTicketResultRes> {
    let staffContext: StaffScanContextReq;
    let dto: ScanTicketReq;

    if ('ticketCode' in staffContextOrReq) {
      dto = staffContextOrReq;
      staffContext = reqOrStaffContext as StaffScanContextReq;
    } else {
      staffContext = staffContextOrReq;
      dto = reqOrStaffContext as ScanTicketReq;
    }

    const normalizedCode = (dto?.ticketCode || '').trim();
    if (!normalizedCode) {
      throw new BadRequestException('Mã vé không được để trống');
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: normalizedCode },
    });

    if (!ticket) {
      throw new NotFoundException(`Mã vé không tồn tại: ${normalizedCode}`);
    }

    if (ticket.ticketStatus === TicketStatus.USED) {
      throw new BadRequestException(
        `Vé đã được sử dụng vào lúc ${ticket.usedAt?.toISOString() || 'trước đó'}`,
      );
    }

    if (ticket.ticketStatus !== TicketStatus.VALID) {
      throw new BadRequestException(
        `Vé không hợp lệ (trạng thái: ${ticket.ticketStatus})`,
      );
    }

    const showtimeDetail =
      await this.showtimeBookingService.getSeatShowtimeDetail(
        ticket.seatShowtimeId,
      );

    if (!showtimeDetail) {
      throw new BadRequestException(
        'Không tìm thấy thông tin suất chiếu cho vé',
      );
    }

    if (staffContext.role === Role.STAFF) {
      if (!staffContext.branchId) {
        throw new ForbiddenException(
          'Nhân viên chưa được gán chi nhánh làm việc',
        );
      }
      if (staffContext.branchId !== showtimeDetail.branchId) {
        throw new ForbiddenException(
          `Vé này thuộc chi nhánh "${showtimeDetail.branchName}". Không thể soát tại chi nhánh khác!`,
        );
      }
    }

    if (dto.showtimeId && showtimeDetail.showtimeId !== dto.showtimeId) {
      throw new BadRequestException(
        `Vé không thuộc suất chiếu đang chọn (Phim: ${showtimeDetail.movieTitle}, Suất: ${showtimeDetail.startTime.toISOString()})`,
      );
    }

    const now = new Date();
    const checkinStartTime = new Date(
      showtimeDetail.startTime.getTime() - 30 * 60 * 1000,
    );
    const checkinEndTime = showtimeDetail.endTime;

    if (now < checkinStartTime) {
      throw new BadRequestException(
        'Chưa đến giờ soát vé. Thời gian soát vé bắt đầu trước 30 phút giờ chiếu',
      );
    }

    if (now > checkinEndTime) {
      throw new BadRequestException(
        'Suất chiếu đã kết thúc, vé đã hết hạn sử dụng',
      );
    }

    const scannedAt = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ticketStatus: TicketStatus.USED,
        usedAt: scannedAt,
        scannedBy: staffContext.staffId,
      },
    });

    await this.internalEventBus.publish(
      new TicketScannedEvent(
        updated.id,
        updated.ticketCode,
        updated.orderId,
        showtimeDetail.showtimeId,
        showtimeDetail.branchId,
        staffContext.staffId,
        scannedAt,
      ),
    );

    const seatLabel = `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`;

    return ScanTicketResultRes.of(
      updated.id,
      updated.ticketCode,
      updated.orderId,
      updated.price,
      updated.ticketStatus as any,
      updated.usedAt ?? undefined,
      updated.seatShowtimeId,
      showtimeDetail.movieTitle,
      showtimeDetail.roomName,
      seatLabel,
      showtimeDetail.startTime,
      showtimeDetail.endTime,
      showtimeDetail.branchId,
      showtimeDetail.branchName,
      showtimeDetail.branchAddress,
      staffContext.staffId,
      scannedAt,
      'Soát vé thành công',
    );
  }

  async getTicketDetail(ticketCode: string): Promise<TicketDetailRes> {
    const normalizedCode = (ticketCode || '').trim();
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: normalizedCode },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Ticket with code ${normalizedCode} not found`,
      );
    }

    const showtimeDetail =
      await this.showtimeBookingService.getSeatShowtimeDetail(
        ticket.seatShowtimeId,
      );

    const seatLabel = showtimeDetail
      ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
      : '';

    return TicketDetailRes.of(
      ticket.id,
      ticket.ticketCode,
      ticket.orderId,
      ticket.price,
      ticket.ticketStatus as any,
      ticket.usedAt ?? undefined,
      ticket.seatShowtimeId,
      showtimeDetail?.movieTitle ?? '',
      showtimeDetail?.roomName ?? '',
      seatLabel,
      showtimeDetail?.startTime ?? new Date(),
      showtimeDetail?.endTime ?? new Date(),
      showtimeDetail?.branchId,
      showtimeDetail?.branchName,
      showtimeDetail?.branchAddress,
    );
  }

  async createTicketsForOrder(
    orderIdOrParams:
      | string
      | {
          orderId: string;
          seatShowtimeIds?: string[];
          items?: Array<{ seatShowtimeId: string; price?: number }>;
        },
    itemsOrTx?: Array<{ seatShowtimeId: string; price?: number }> | any,
    prismaTx?: any,
  ): Promise<TicketItemSummaryRes[]> {
    let orderId: string;
    let seatShowtimeIds: string[] = [];
    const priceMap = new Map<string, number>();
    let client: any;

    if (typeof orderIdOrParams === 'string') {
      orderId = orderIdOrParams;
      if (Array.isArray(itemsOrTx)) {
        seatShowtimeIds = itemsOrTx.map((item) => {
          if (item.price !== undefined) {
            priceMap.set(item.seatShowtimeId, item.price);
          }
          return item.seatShowtimeId;
        });
      }
      client = prismaTx ?? this.prisma;
    } else {
      orderId = orderIdOrParams.orderId;
      if (orderIdOrParams.seatShowtimeIds) {
        seatShowtimeIds = orderIdOrParams.seatShowtimeIds;
      } else if (orderIdOrParams.items) {
        seatShowtimeIds = orderIdOrParams.items.map((item) => {
          if (item.price !== undefined) {
            priceMap.set(item.seatShowtimeId, item.price);
          }
          return item.seatShowtimeId;
        });
      }
      client = itemsOrTx ?? this.prisma;
    }

    if (!orderId) {
      throw new BadRequestException('Mã đơn hàng không được để trống');
    }
    const existing = await this.getTicketsByOrderId(orderId, client);
    if (existing.length > 0) {
      return existing;
    }

    if (!seatShowtimeIds || seatShowtimeIds.length === 0) {
      throw new BadRequestException('Danh sách ghế không được để trống');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketsToCreate = [];

    for (const seatShowtimeId of seatShowtimeIds) {
      const showtimeDetail =
        await this.showtimeBookingService.getSeatShowtimeDetail(seatShowtimeId);
      if (!showtimeDetail) {
        throw new BadRequestException(
          `Không tìm thấy thông tin suất chiếu cho ghế ${seatShowtimeId}`,
        );
      }

      const randomSuffix = randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)
        .toUpperCase();
      const ticketCode = `TK-${dateStr}-${randomSuffix}`;

      ticketsToCreate.push({
        orderId,
        seatShowtimeId,
        ticketCode,
        price: priceMap.get(seatShowtimeId) ?? showtimeDetail.price ?? 0,
        ticketStatus: TicketStatus.VALID,
      });
    }

    await client.ticket.createMany({ data: ticketsToCreate });
    return this.getTicketsByOrderId(orderId, client);
  }

  async getTicketsByOrderId(
    orderId: string,
    prismaTx?: any,
  ): Promise<TicketItemSummaryRes[]> {
    const client = prismaTx ?? this.prisma;
    const tickets = await client.ticket.findMany({ where: { orderId } });
    if (!tickets || tickets.length === 0) {
      return [];
    }

    const results: TicketItemSummaryRes[] = [];
    for (const ticket of tickets) {
      const showtimeDetail =
        await this.showtimeBookingService.getSeatShowtimeDetail(
          ticket.seatShowtimeId,
        );
      const seatLabel = showtimeDetail
        ? `${showtimeDetail.rowPosition || ''}${showtimeDetail.columnPosition || ''}`
        : '';

      results.push(
        TicketItemSummaryRes.of(
          ticket.id,
          ticket.ticketCode,
          ticket.price,
          ticket.ticketStatus,
          ticket.usedAt ?? undefined,
          ticket.seatShowtimeId,
          showtimeDetail?.movieTitle ?? '',
          showtimeDetail?.roomName ?? '',
          seatLabel,
          showtimeDetail?.startTime ?? new Date(),
          showtimeDetail?.endTime ?? new Date(),
          showtimeDetail?.branchId,
          showtimeDetail?.branchName,
          showtimeDetail?.branchAddress,
        ),
      );
    }

    return results;
  }
}
