import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  ORDER_BOOKING_MESSAGES,
  ORDER_EXPIRATION_QUEUE,
  ORDER_HOLD_TIMEOUT_MS,
} from '../../domain/constants/order.constant';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';
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
  CreatePosOrderReq,
} from '../dto/req.dto';
import {
  BookingProductRes,
  BookingSeatRes,
  OrderPaymentInfoDto,
  PosBookingSummaryRes,
  PosReceiptItemRes,
  PosReceiptRes,
  PosReceiptSeatRes,
  PosReceiptTicketRes,
} from '../dto/res.dto';
import { OrderService } from './order.service';
import { TicketService } from './ticket.service';

@Injectable()
export class PosOrderService {
  private readonly logger = new Logger(PosOrderService.name);

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
    private readonly ticketService: TicketService,
    private readonly orderService: OrderService,
  ) {}

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
    await this.orderService.cancelOrder(
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

    let tickets = await this.ticketService.getTicketsByOrderId(orderId);
    const seatOrders = await this.prisma.seatOrder.findMany({
      where: { orderId },
    });
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

    if (!tickets.length && seatShowtimeIds.length) {
      tickets = await this.ticketService.createTicketsForOrder({
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
}
