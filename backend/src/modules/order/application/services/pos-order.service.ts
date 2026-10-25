import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
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
import { OrderCancelledEvent } from '../../domain/events/order-cancelled.event';
import { OrderPaidEvent } from '../../domain/events/order-paid.event';
import {
  SHOWTIME_BOOKING,
  ShowtimeBookingContract,
} from '../../contracts/showtime-booking.contract';
import {
  TICKET_CONTRACT,
  TicketContract,
} from '../../contracts/ticket.contract';
import {
  PRODUCT_CONTRACT,
  ProductContract,
  ProductSummaryDto,
} from '../../contracts/product.contract';
import {
  PROMOTION_CONTRACT,
  PromotionContract,
} from '../../contracts/promotion.contract';
import {
  PAYMENT_CONTRACT,
  PaymentContract,
  PaymentStatus,
} from '../../contracts/payment.contract';
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
  InitiatePosQrPaymentReq,
  ProcessPosCashPaymentReq,
} from '../dto/req.dto';
import {
  PosBookingSummaryRes,
  PosCashPaymentResultRes,
  PosQrPaymentRes,
  PosReceiptRes,
} from '../dto/res.dto';
import { CreatePosBookingOrderUsecase } from '../usecase/create-pos-booking-order.usecase';
import { CancelPosOrderUsecase } from '../usecase/cancel-pos-order.usecase';
import { ConfirmPosCashPaymentUsecase } from '../usecase/confirm-pos-cash-payment.usecase';
import { InitiatePosQrPaymentUsecase } from '../usecase/initiate-pos-qr-payment.usecase';
import { CheckPosPaymentStatusUsecase } from '../usecase/check-pos-payment-status.usecase';
import { GetPosReceiptUsecase } from '../usecase/get-pos-receipt.usecase';

@Injectable()
export class PosOrderService
  implements
    CreatePosBookingOrderUsecase,
    CancelPosOrderUsecase,
    ConfirmPosCashPaymentUsecase,
    InitiatePosQrPaymentUsecase,
    CheckPosPaymentStatusUsecase,
    GetPosReceiptUsecase
{
  private readonly logger = new Logger(PosOrderService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(SeatOrder.name)
    private readonly seatOrderModel: Model<SeatOrderDocument>,
    @InjectModel(ProductOrder.name)
    private readonly productOrderModel: Model<ProductOrderDocument>,
    @Inject(SHOWTIME_BOOKING)
    private readonly showtimeBookingService: ShowtimeBookingContract,
    @Inject(TICKET_CONTRACT)
    private readonly ticketContract: TicketContract,
    @Inject(PRODUCT_CONTRACT)
    private readonly productContract: ProductContract,
    @Inject(PROMOTION_CONTRACT)
    private readonly promotionContract: PromotionContract,
    @Inject(PAYMENT_CONTRACT)
    private readonly paymentContract: PaymentContract,
    @Inject(QUEUE_SERVICE)
    private readonly queueService: QueueService,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly internalEventBus: InternalEventBus,
  ) {}

  async createPosBookingOrder(
    staffContext: { staffId: string; branchId: string },
    request: CreatePosOrderReq,
  ): Promise<PosBookingSummaryRes> {
    if (!request.seatShowtimeIds?.length) {
      throw new BadRequestException('Danh sách ghế không được để trống');
    }

    const reservedSeats = await this.showtimeBookingService.reserveSeats(
      request.seatShowtimeIds,
    );

    if (
      reservedSeats.some(
        (seat) => seat.branchId && seat.branchId !== staffContext.branchId,
      )
    ) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      throw new ForbiddenException(
        'Suất chiếu không thuộc chi nhánh của nhân viên',
      );
    }

    const productIds = request.products?.map((p) => p.productId) ?? [];
    const productsMap: Map<string, ProductSummaryDto> = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    if (request.products?.length) {
      for (const item of request.products) {
        const prod = productsMap.get(item.productId);
        if (!prod) {
          await this.showtimeBookingService.releaseSeats(
            request.seatShowtimeIds,
          );
          throw new NotFoundException(
            `Sản phẩm F&B ${item.productId} không tồn tại`,
          );
        }
        if (prod.branchId && prod.branchId !== staffContext.branchId) {
          await this.showtimeBookingService.releaseSeats(
            request.seatShowtimeIds,
          );
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

    const orderId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);

    try {
      await this.orderModel.create({
        orderId,
        userId: staffContext.staffId,
        totalAmount,
        status: OrderStatus.PENDING,
      });

      const seatOrdersData = reservedSeats.map((seat) => ({
        seatOrderId: randomUUID(),
        orderId,
        seatShowtimeId: seat.seatShowtimeId,
        price: seat.basePrice,
        orderAt: createdAt,
      }));
      await this.seatOrderModel.insertMany(seatOrdersData);

      if (request.products?.length) {
        const productOrdersData = request.products.map((item) => ({
          productOrderId: randomUUID(),
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: productsMap.get(item.productId)?.unitPrice ?? 0,
        }));
        await this.productOrderModel.insertMany(productOrdersData);
      }
    } catch (dbError) {
      await this.showtimeBookingService.releaseSeats(request.seatShowtimeIds);
      await this.orderModel.deleteOne({ orderId }).exec();
      await this.seatOrderModel.deleteMany({ orderId }).exec();
      await this.productOrderModel.deleteMany({ orderId }).exec();
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
      await this.orderModel.deleteOne({ orderId }).exec();
      await this.seatOrderModel.deleteMany({ orderId }).exec();
      await this.productOrderModel.deleteMany({ orderId }).exec();
      throw queueError;
    }

    try {
      await this.internalEventBus.publish(
        new OrderCreatedEvent(
          orderId,
          staffContext.staffId,
          totalAmount,
          expiresAt,
          request.seatShowtimeIds,
        ),
      );
    } catch (eventError) {
      this.logger.warn(
        `Failed to publish OrderCreatedEvent for POS order ${orderId}: ${(eventError as Error)?.message}`,
      );
    }

    return {
      orderId,
      userId: staffContext.staffId,
      status: OrderStatus.PENDING,
      totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds: Math.floor(ORDER_HOLD_TIMEOUT_MS / 1000),
      seats: reservedSeats.map((s) => ({
        seatShowtimeId: s.seatShowtimeId,
        seatId: s.seatId,
        rowPosition: s.rowPosition,
        columnPosition: s.columnPosition,
        seatType: s.seatType,
        price: s.basePrice,
      })),
      products: (request.products ?? []).map((p) => {
        const prod = productsMap.get(p.productId);
        return {
          productId: p.productId,
          productName: prod?.productName ?? p.productId,
          quantity: p.quantity,
          unitPrice: prod?.unitPrice ?? 0,
        };
      }),
    };
  }

  async applyPosPromotion(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<PosBookingSummaryRes> {
    const order = await this.orderModel.findOne({ orderId }).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể áp dụng mã giảm giá cho đơn hàng đang chờ thanh toán',
      );
    }

    const validation = await this.promotionContract.validatePromotionCode({
      code: request.promotionCode,
      orderAmount: order.totalAmount,
      userId: order.userId,
    });

    if (!validation.isValid) {
      throw new BadRequestException(
        validation.reason || 'Mã khuyến mãi không hợp lệ',
      );
    }

    order.promotionId = validation.promotionId;
    order.totalAmount = Math.max(
      0,
      order.totalAmount - validation.discountAmount,
    );
    await order.save();

    return this.buildPosBookingSummary(order);
  }

  async cancelPosOrder(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request?: CancelPosOrderReq,
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.orderModel.findOne({ orderId }).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán',
      );
    }

    const seatOrders = await this.seatOrderModel.find({ orderId }).exec();
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

    order.status = OrderStatus.CANCELLED;
    await order.save();

    if (seatShowtimeIds.length) {
      await this.showtimeBookingService.releaseSeats(seatShowtimeIds);
    }

    try {
      await this.internalEventBus.publish(
        new OrderCancelledEvent(
          orderId,
          staffContext.staffId,
          seatShowtimeIds,
          request?.reason || 'Hủy tại quầy',
          new Date(),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish OrderCancelledEvent for order ${orderId}: ${(err as Error)?.message}`,
      );
    }

    return {
      success: true,
      message: 'Đã hủy đơn hàng và nhả ghế thành công',
    };
  }

  async confirmPosCashPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: ProcessPosCashPaymentReq,
  ): Promise<PosCashPaymentResultRes> {
    const order = await this.orderModel.findOne({ orderId }).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }

    const amountToPay = order.totalAmount;
    if (request.cashReceived < amountToPay) {
      throw new BadRequestException('Số tiền nhận từ khách không đủ');
    }

    const cashPayment = await this.paymentContract.processCashPayment({
      orderId,
      totalAmount: amountToPay,
      cashReceived: request.cashReceived,
    });

    const seatOrders = await this.seatOrderModel.find({ orderId }).exec();
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

    await this.showtimeBookingService.confirmSeats(seatShowtimeIds);
    const tickets = await this.ticketContract.createTicketsForOrder({
      orderId,
      seatShowtimeIds,
    });

    const productOrders = await this.productOrderModel.find({ orderId }).exec();
    if (productOrders.length) {
      await this.productContract.deductConcessionStock(
        productOrders.map((po) => ({
          productId: po.productId,
          quantity: po.quantity,
        })),
      );
    }

    order.status = OrderStatus.PAID;
    await order.save();

    try {
      await this.internalEventBus.publish(
        new OrderPaidEvent(
          orderId,
          staffContext.staffId,
          staffContext.branchId,
          amountToPay,
          'CASH',
          new Date(),
        ),
      );
    } catch (eventError) {
      this.logger.warn(
        `Failed to publish OrderPaidEvent for order ${orderId}: ${(eventError as Error)?.message}`,
      );
    }

    return {
      orderId,
      paymentId: cashPayment.paymentId,
      status: OrderStatus.PAID,
      totalAmount: amountToPay,
      cashReceived: request.cashReceived,
      changeAmount:
        cashPayment.changeAmount ?? request.cashReceived - amountToPay,
      paidAt: cashPayment.paidAt || new Date(),
      tickets,
    };
  }

  async initiatePosQrPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: InitiatePosQrPaymentReq,
  ): Promise<PosQrPaymentRes> {
    const order = await this.orderModel.findOne({ orderId }).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }

    const amountToPay = order.totalAmount;
    const qrPayment = await this.paymentContract.generateQrPayment({
      orderId,
      amount: amountToPay,
      method: request.paymentMethod,
      description: `Thanh toan ve quay ${orderId}`,
    });

    return {
      orderId,
      paymentId: qrPayment.paymentId,
      amount: amountToPay,
      paymentMethod: request.paymentMethod,
      paymentStatus: qrPayment.status,
      qrCodeUrl: qrPayment.qrCodeUrl,
      qrPayload: qrPayment.qrPayload,
    };
  }

  async checkPosPaymentStatus(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
  ): Promise<PosCashPaymentResultRes | PosQrPaymentRes> {
    const order = await this.orderModel.findOne({ orderId }).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    const amountToPay = order.totalAmount;

    if (order.status === OrderStatus.PAID) {
      const tickets = await this.ticketContract.getTicketsByOrderId(orderId);
      const paidAt = (order.get('updatedAt') as Date | undefined) ?? new Date();
      return {
        orderId,
        paymentId: 'PAID',
        status: OrderStatus.PAID,
        totalAmount: amountToPay,
        cashReceived: amountToPay,
        changeAmount: 0,
        paidAt,
        tickets,
      };
    }

    const statusSummary =
      await this.paymentContract.checkPaymentStatus(orderId);

    if (
      statusSummary.status === PaymentStatus.SUCCESS ||
      (statusSummary.status as string) === 'SUCCESS'
    ) {
      const seatOrders = await this.seatOrderModel.find({ orderId }).exec();
      const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);

      await this.showtimeBookingService.confirmSeats(seatShowtimeIds);
      const tickets = await this.ticketContract.createTicketsForOrder({
        orderId,
        seatShowtimeIds,
      });

      const productOrders = await this.productOrderModel
        .find({ orderId })
        .exec();
      if (productOrders.length) {
        await this.productContract.deductConcessionStock(
          productOrders.map((po) => ({
            productId: po.productId,
            quantity: po.quantity,
          })),
        );
      }

      order.status = OrderStatus.PAID;
      await order.save();

      const paymentMethod = statusSummary.method || 'QR';
      try {
        await this.internalEventBus.publish(
          new OrderPaidEvent(
            orderId,
            staffContext.staffId,
            staffContext.branchId,
            amountToPay,
            paymentMethod,
            new Date(),
          ),
        );
      } catch (eventError) {
        this.logger.warn(
          `Failed to publish OrderPaidEvent for order ${orderId}: ${(eventError as Error)?.message}`,
        );
      }

      return {
        orderId,
        paymentId: statusSummary.paymentId,
        status: OrderStatus.PAID,
        totalAmount: amountToPay,
        cashReceived: amountToPay,
        changeAmount: 0,
        paidAt: new Date(),
        tickets,
      };
    }

    return {
      orderId,
      paymentId: statusSummary.paymentId,
      amount: statusSummary.amount,
      paymentMethod: statusSummary.method,
      paymentStatus: statusSummary.status,
      qrCodeUrl: '',
      qrPayload: '',
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
    const order = await this.orderModel.findOne({ orderId }).exec();
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
        await this.paymentContract.checkPaymentStatus(orderId);
      if (paymentStatus?.method) {
        paymentMethod = paymentStatus.method;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to check payment status for receipt ${orderId}: ${(err as Error)?.message}`,
      );
    }

    const tickets = await this.ticketContract.getTicketsByOrderId(orderId);
    const productOrders = await this.productOrderModel.find({ orderId }).exec();
    const productIds = productOrders.map((po) => po.productId);
    const productsMap: Map<string, ProductSummaryDto> = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    return {
      orderId,
      branchName:
        staffContext.branchName || `MyCast Chi nhánh ${staffContext.branchId}`,
      branchAddress:
        staffContext.branchAddress || 'Chi nhánh hệ thống rạp MyCast',
      staffName: staffContext.staffName || 'Thu ngân',
      printedAt: new Date(),
      paymentMethod,
      totalAmount: order.totalAmount,
      cashReceived: paymentMethod === 'CASH' ? order.totalAmount : undefined,
      changeAmount: 0,
      tickets: tickets.map((t) => ({
        ticketCode: t.ticketCode,
        movieTitle: t.movieTitle,
        roomName: t.roomName,
        seatLabel: t.seatLabel,
        startTime: t.startTime,
        endTime: t.endTime,
        price: t.price,
      })),
      products: productOrders.map((po) => {
        const prod = productsMap.get(po.productId);
        return {
          productName: prod?.productName || po.productId,
          quantity: po.quantity,
          unitPrice: po.unitPrice,
          subTotal: po.quantity * po.unitPrice,
        };
      }),
    };
  }

  private async verifyOrderBranch(
    orderId: string,
    branchId: string,
  ): Promise<void> {
    const seatOrders = await this.seatOrderModel.find({ orderId }).exec();
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
    order: OrderDocument,
  ): Promise<PosBookingSummaryRes> {
    const seatOrders = await this.seatOrderModel
      .find({ orderId: order.orderId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) => so.seatShowtimeId);
    const seats = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const productOrders = await this.productOrderModel
      .find({ orderId: order.orderId })
      .exec();
    const productIds = productOrders.map((po) => po.productId);
    const productsMap: Map<string, ProductSummaryDto> = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    const createdAt =
      (order.get('createdAt') as Date | undefined) ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);
    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    return {
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt,
      expiresAt,
      remainingSeconds,
      seats: seats.map((s) => ({
        seatShowtimeId: s.seatShowtimeId,
        seatId: s.seatId,
        rowPosition: s.rowPosition,
        columnPosition: s.columnPosition,
        seatType: s.seatType,
        price: s.basePrice,
      })),
      products: productOrders.map((po) => {
        const prod = productsMap.get(po.productId);
        return {
          productId: po.productId,
          productName: prod?.productName || po.productId,
          quantity: po.quantity,
          unitPrice: po.unitPrice,
        };
      }),
    };
  }
}
