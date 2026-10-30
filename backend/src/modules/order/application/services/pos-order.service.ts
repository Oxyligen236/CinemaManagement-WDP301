import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  TicketItemSummaryDto,
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

  private toOrderObjectId(orderId: string): Types.ObjectId {
    return Types.ObjectId.isValid(orderId)
      ? new Types.ObjectId(orderId)
      : (orderId as unknown as Types.ObjectId);
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
    const productsMap: Map<string, ProductSummaryDto> = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

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

    const orderObjectId = new Types.ObjectId();
    const orderId = orderObjectId.toString();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ORDER_HOLD_TIMEOUT_MS);

    const staffObjectId = Types.ObjectId.isValid(staffContext.staffId)
      ? new Types.ObjectId(staffContext.staffId)
      : (staffContext.staffId as unknown as Types.ObjectId);

    const branchObjectId = Types.ObjectId.isValid(staffContext.branchId)
      ? new Types.ObjectId(staffContext.branchId)
      : (staffContext.branchId as unknown as Types.ObjectId);

    try {
      await this.orderModel.create({
        _id: orderObjectId,
        userId: staffObjectId,
        branchId: branchObjectId,
        totalAmount,
        status: OrderStatus.PENDING,
      });

      if (hasSeats && reservedSeats.length > 0) {
        const seatOrdersData = reservedSeats.map((seat) => ({
          orderId: orderObjectId,
          seatShowtimeId: Types.ObjectId.isValid(seat.seatShowtimeId)
            ? new Types.ObjectId(seat.seatShowtimeId)
            : (seat.seatShowtimeId as unknown as Types.ObjectId),
          price: seat.basePrice,
          orderAt: createdAt,
        }));
        await this.seatOrderModel.insertMany(seatOrdersData);
      }

      if (request.products?.length) {
        const productOrdersData = request.products.map((item) => ({
          orderId: orderObjectId,
          productId: Types.ObjectId.isValid(item.productId)
            ? new Types.ObjectId(item.productId)
            : (item.productId as unknown as Types.ObjectId),
          quantity: item.quantity,
          unitPrice: productsMap.get(item.productId)?.unitPrice ?? 0,
        }));
        await this.productOrderModel.insertMany(productOrdersData);
      }
    } catch (dbError) {
      if (hasSeats) {
        await this.showtimeBookingService.releaseSeats(
          request.seatShowtimeIds!,
        );
      }
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
      if (hasSeats) {
        await this.showtimeBookingService.releaseSeats(
          request.seatShowtimeIds!,
        );
      }
      await this.orderModel.deleteOne({ _id: orderObjectId }).exec();
      await this.seatOrderModel.deleteMany({ orderId: orderObjectId }).exec();
      await this.productOrderModel
        .deleteMany({ orderId: orderObjectId })
        .exec();
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
    const order = await this.orderModel.findById(orderId).exec();
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
      userId: order.userId.toString(),
    });

    if (!validation.isValid) {
      throw new BadRequestException(
        validation.reason || 'Mã khuyến mãi không hợp lệ',
      );
    }

    if (
      validation.promotionId &&
      Types.ObjectId.isValid(validation.promotionId)
    ) {
      order.promotionId = new Types.ObjectId(validation.promotionId);
    }
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
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    await this.verifyOrderBranch(orderId, staffContext.branchId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán',
      );
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );

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
    const order = await this.orderModel.findById(orderId).exec();
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

    const orderObjectId = this.toOrderObjectId(orderId);
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );

    let tickets: TicketItemSummaryDto[] = [];
    if (seatShowtimeIds.length > 0) {
      await this.showtimeBookingService.confirmSeats(seatShowtimeIds);
      tickets = await this.ticketContract.createTicketsForOrder({
        orderId,
        seatShowtimeIds,
      });
    }

    const productOrders = await this.productOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    if (productOrders.length) {
      await this.productContract.deductConcessionStock(
        productOrders.map((po) => ({
          productId: po.productId.toString(),
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
          order.promotionId ? order.promotionId.toString() : undefined,
          order.userId.toString(),
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
    const order = await this.orderModel.findById(orderId).exec();
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
    const order = await this.orderModel.findById(orderId).exec();
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
      const orderObjectId = this.toOrderObjectId(orderId);
      const seatOrders = await this.seatOrderModel
        .find({ orderId: orderObjectId })
        .exec();
      const seatShowtimeIds = seatOrders.map((so) =>
        so.seatShowtimeId.toString(),
      );

      let tickets: TicketItemSummaryDto[] = [];
      if (seatShowtimeIds.length > 0) {
        await this.showtimeBookingService.confirmSeats(seatShowtimeIds);
        tickets = await this.ticketContract.createTicketsForOrder({
          orderId,
          seatShowtimeIds,
        });
      }

      const productOrders = await this.productOrderModel
        .find({ orderId: orderObjectId })
        .exec();
      if (productOrders.length) {
        await this.productContract.deductConcessionStock(
          productOrders.map((po) => ({
            productId: po.productId.toString(),
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
            order.promotionId ? order.promotionId.toString() : undefined,
            order.userId.toString(),
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
    const order = await this.orderModel.findById(orderId).exec();
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

    let tickets = await this.ticketContract.getTicketsByOrderId(orderId);
    const orderObjectId = this.toOrderObjectId(orderId);
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );

    if (!tickets.length && seatShowtimeIds.length) {
      tickets = await this.ticketContract.createTicketsForOrder({
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

    const productOrders = await this.productOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const productIds = productOrders.map((po) => po.productId.toString());
    const productsMap: Map<string, ProductSummaryDto> = productIds.length
      ? await this.productContract.getProductsByIds(productIds)
      : new Map<string, ProductSummaryDto>();

    return {
      orderId,
      orderCode: order._id.toString().slice(-8).toUpperCase(),
      branchName:
        firstTicket?.branchName ||
        staffContext.branchName ||
        `MyCast Chi nhánh ${staffContext.branchId}`,
      branchAddress:
        firstTicket?.branchAddress ||
        staffContext.branchAddress ||
        'Chi nhánh hệ thống rạp MyCast',
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
        return {
          seatName: t.seatLabel,
          seatType,
          price: t.price,
        };
      }),
      tickets: tickets.map((t) => {
        const seatType =
          (t.seatShowtimeId && seatBookingMap.get(t.seatShowtimeId)) ||
          'Tiêu chuẩn';
        return {
          ticketCode: t.ticketCode,
          movieTitle: t.movieTitle,
          roomName: t.roomName,
          seatLabel: t.seatLabel,
          seatName: t.seatLabel,
          seatType,
          startTime: t.startTime,
          endTime: t.endTime,
          price: t.price,
        };
      }),
      products: productOrders.map((po) => {
        const pIdStr = po.productId.toString();
        const prod = productsMap.get(pIdStr);
        return {
          productName: prod?.productName || pIdStr,
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
    const order = await this.orderModel.findById(orderId).exec();
    if (order?.branchId && order.branchId.toString() !== branchId) {
      throw new ForbiddenException(
        'Đơn hàng không thuộc chi nhánh của nhân viên',
      );
    }

    const orderObjectId = this.toOrderObjectId(orderId);
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );
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
    const orderObjectId = order._id;
    const seatOrders = await this.seatOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const seatShowtimeIds = seatOrders.map((so) =>
      so.seatShowtimeId.toString(),
    );
    const seats = seatShowtimeIds.length
      ? await this.showtimeBookingService.getSeatBookingDetails(seatShowtimeIds)
      : [];

    const productOrders = await this.productOrderModel
      .find({ orderId: orderObjectId })
      .exec();
    const productIds = productOrders.map((po) => po.productId.toString());
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
      orderId: order._id.toString(),
      userId: order.userId.toString(),
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
        const pIdStr = po.productId.toString();
        const prod = productsMap.get(pIdStr);
        return {
          productId: pIdStr,
          productName: prod?.productName || pIdStr,
          quantity: po.quantity,
          unitPrice: po.unitPrice,
        };
      }),
    };
  }
}
