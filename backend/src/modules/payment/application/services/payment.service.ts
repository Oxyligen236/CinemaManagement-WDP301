import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VNPay, ignoreLogger } from 'vnpay';
import {
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { OrderService } from '../../../order/application/services/order.service';
import { PaymentMethod } from '../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import {
  InitiatePosQrPaymentReq,
  ProcessPosCashPaymentReq,
} from '../dto/req.dto';
import {
  CashPaymentSummaryDto,
  PaymentStatusSummaryDto,
  PosCashPaymentResultRes,
  PosQrPaymentRes,
  QrPaymentSummaryDto,
  VnpayPaymentUrlDto,
} from '../dto/res.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async createVnpayPayment(
    userId: string,
    orderId: string,
    ipAddr: string,
  ): Promise<VnpayPaymentUrlDto> {
    const order = await this.orderService.getOrderForOnlinePayment(
      userId,
      orderId,
    );
    const returnUrl = process.env.VNPAY_RETURN_URL;
    if (!returnUrl) {
      throw new BadRequestException('VNPAY_RETURN_URL chưa được cấu hình');
    }
    return this.buildVnpayPaymentUrl({
      orderId: order.orderId,
      amount: order.totalAmount,
      ipAddr,
      returnUrl,
    });
  }

  private async buildVnpayPaymentUrl(params: {
    orderId: string;
    amount: number;
    ipAddr: string;
    returnUrl: string;
  }): Promise<VnpayPaymentUrlDto> {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret) {
      throw new BadRequestException('VNPay sandbox chưa được cấu hình');
    }
    if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }

    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId: params.orderId,
        method: PrismaPaymentMethod.VNPAY,
        status: PrismaPaymentStatus.PENDING,
      },
    });

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: params.orderId,
          amount: params.amount,
          method: PrismaPaymentMethod.VNPAY,
          status: PrismaPaymentStatus.PENDING,
        },
      });
    } else if (payment.amount !== params.amount) {
      throw new BadRequestException('Số tiền đơn hàng đã thay đổi');
    }

    const vnpay = new VNPay({
      tmnCode,
      secureSecret,
      vnpayHost: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn',
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    });
    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: params.amount,
      vnp_IpAddr: params.ipAddr,
      vnp_ReturnUrl: params.returnUrl,
      vnp_TxnRef: payment.id,
      vnp_OrderInfo: `Thanh toan don ${params.orderId}`,
    });

    return VnpayPaymentUrlDto.of(
      payment.id,
      params.orderId,
      paymentUrl,
      payment.status as unknown as PaymentStatus,
    );
  }

  async handleVnpayReturn(query: Record<string, string | string[]>) {
    const result = await this.verifyVnpayReturn(query);
    if (!result.isSuccess) return result;
    await this.orderService.fulfillVnpayOrder(result.orderId);
    return result;
  }

  async handleVnpayIpn(query: Record<string, string | string[]>) {
    const result = await this.verifyVnpayIpn(query);
    if (result.RspCode !== '00' || !result.isSuccess || !result.orderId) {
      return result;
    }
    await this.orderService.fulfillVnpayOrder(result.orderId);
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async verifyVnpayReturn(query: Record<string, string | string[]>) {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret) {
      throw new BadRequestException('VNPay chưa được cấu hình');
    }
    const result = new VNPay({
      tmnCode,
      secureSecret,
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    }).verifyReturnUrl(query as Parameters<VNPay['verifyReturnUrl']>[0]);
    const paymentId =
      typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, method: PrismaPaymentMethod.VNPAY },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch VNPay');
    }
    if (!result.isVerified || Number(result.vnp_Amount) !== payment.amount) {
      throw new BadRequestException('Thông tin giao dịch VNPay không hợp lệ');
    }
    return {
      isSuccess: result.isVerified && result.isSuccess,
      orderId: payment.orderId,
      message: result.message,
      responseCode: String(query.vnp_ResponseCode || ''),
    };
  }

  async verifyVnpayIpn(query: Record<string, string | string[]>) {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret) {
      throw new BadRequestException('VNPay chưa được cấu hình');
    }
    const result = new VNPay({
      tmnCode,
      secureSecret,
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    }).verifyIpnCall(query as Parameters<VNPay['verifyIpnCall']>[0]);
    if (!result.isVerified) {
      return { RspCode: '97', Message: 'Invalid checksum' };
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: result.vnp_TxnRef, method: PrismaPaymentMethod.VNPAY },
    });
    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    if (Number(result.vnp_Amount) !== payment.amount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }
    if (payment.status !== PrismaPaymentStatus.PENDING) {
      return payment.status === PrismaPaymentStatus.SUCCESS
        ? {
            RspCode: '00',
            Message: 'Confirm Success',
            orderId: payment.orderId,
            isSuccess: true,
          }
        : {
            RspCode: '02',
            Message: 'Order already confirmed',
            orderId: payment.orderId,
            isSuccess: false,
          };
    }

    const nextStatus = result.isSuccess
      ? PrismaPaymentStatus.SUCCESS
      : PrismaPaymentStatus.FAILED;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        transactionId: String(result.vnp_TransactionNo || ''),
      },
    });

    return {
      RspCode: '00',
      Message: 'Confirm Success',
      orderId: payment.orderId,
      isSuccess: result.isSuccess,
    };
  }

  async getVnpayPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, method: PrismaPaymentMethod.VNPAY },
      orderBy: { createdAt: 'desc' },
    });
    return { isSuccess: payment?.status === PrismaPaymentStatus.SUCCESS };
  }

  async processCashPayment(params: {
    orderId: string;
    totalAmount: number;
    cashReceived: number;
  }): Promise<CashPaymentSummaryDto> {
    if (params.cashReceived < params.totalAmount) {
      throw new BadRequestException(
        `Số tiền khách đưa (${params.cashReceived.toLocaleString('vi-VN')} đ) không đủ để thanh toán tổng tiền (${params.totalAmount.toLocaleString('vi-VN')} đ)`,
      );
    }

    const changeAmount = params.cashReceived - params.totalAmount;
    const now = new Date();

    const created = await this.prisma.payment.create({
      data: {
        orderId: params.orderId,
        amount: params.totalAmount,
        method: PrismaPaymentMethod.CASH,
        status: PrismaPaymentStatus.SUCCESS,
        transactionId: `CASH-${Date.now()}-${randomUUID().slice(0, 8)}`,
      },
    });

    return CashPaymentSummaryDto.of(
      created.id,
      created.orderId,
      created.amount,
      params.cashReceived,
      changeAmount,
      created.method as unknown as PaymentMethod,
      created.status as unknown as PaymentStatus,
      now,
    );
  }

  async generateQrPayment(params: {
    orderId: string;
    amount: number;
    method?: PaymentMethod;
    description?: string;
  }): Promise<QrPaymentSummaryDto> {
    if (params.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    const method = params.method ?? PaymentMethod.VNPAY;
    const description =
      params.description || `MYCAST ${params.orderId.slice(0, 8)}`;

    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId: params.orderId,
        status: PrismaPaymentStatus.PENDING,
      },
    });

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: params.orderId,
          amount: params.amount,
          method,
          status: PrismaPaymentStatus.PENDING,
          transactionId: `QR-${Date.now()}-${randomUUID().slice(0, 8)}`,
        },
      });
    }

    const bankId = process.env.VIETQR_BANK_ID || 'MB';
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0333888999';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'MYCAST CINEMA';
    const encodedDesc = encodeURIComponent(description);
    const encodedAccountName = encodeURIComponent(accountName);

    const qrCodeUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodedDesc}&accountName=${encodedAccountName}`;
    const qrPayload = `00020101021238540010A00000072701240006${bankId}0110${accountNo}0208QRIBFTTA5303704540${params.amount}5802VN62${description.length}${description}6304`;

    return QrPaymentSummaryDto.of(
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method as unknown as PaymentMethod,
      payment.status as unknown as PaymentStatus,
      qrCodeUrl,
      qrPayload,
    );
  }

  async checkPaymentStatus(
    identifier: string,
  ): Promise<PaymentStatusSummaryDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ id: identifier }, { orderId: identifier }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy giao dịch thanh toán cho mã: ${identifier}`,
      );
    }

    return PaymentStatusSummaryDto.of(
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method as unknown as PaymentMethod,
      payment.status as unknown as PaymentStatus,
      payment.transactionId ?? undefined,
    );
  }

  async confirmPosCashPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: ProcessPosCashPaymentReq,
  ): Promise<PosCashPaymentResultRes> {
    const order = await this.orderService.getOrderForPosPayment(
      staffContext,
      orderId,
    );

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }

    const amountToPay = order.totalAmount;
    if (request.cashReceived < amountToPay) {
      throw new BadRequestException('Số tiền nhận từ khách không đủ');
    }

    const cashPayment = await this.processCashPayment({
      orderId,
      totalAmount: amountToPay,
      cashReceived: request.cashReceived,
    });

    const { tickets, paidAt } = await this.orderService.fulfillOrderPayment(
      orderId,
      cashPayment.paymentId,
      {
        paymentMethod: 'CASH',
        branchId: staffContext.branchId,
        staffId: staffContext.staffId,
      },
    );

    return PosCashPaymentResultRes.of(
      orderId,
      cashPayment.paymentId,
      'PAID',
      amountToPay,
      request.cashReceived,
      cashPayment.changeAmount ?? request.cashReceived - amountToPay,
      paidAt,
      tickets,
    );
  }

  async initiatePosQrPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: InitiatePosQrPaymentReq,
  ): Promise<PosQrPaymentRes> {
    const order = await this.orderService.getOrderForPosPayment(
      staffContext,
      orderId,
    );

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }

    const amountToPay = order.totalAmount;
    const qrPayment = await this.generateQrPayment({
      orderId,
      amount: amountToPay,
      method: request.paymentMethod,
      description: `Thanh toan ve quay ${orderId}`,
    });

    return PosQrPaymentRes.of(
      orderId,
      qrPayment.paymentId,
      amountToPay,
      request.paymentMethod,
      qrPayment.status,
      qrPayment.qrCodeUrl,
      qrPayment.qrPayload,
    );
  }

  async checkPosPaymentStatus(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
  ): Promise<PosCashPaymentResultRes | PosQrPaymentRes> {
    const order = await this.orderService.getOrderForPosPayment(
      staffContext,
      orderId,
    );

    const amountToPay = order.totalAmount;

    if (order.status === 'PAID') {
      const tickets = await this.orderService.getPaidOrderTickets(orderId);
      const paidAt = order.updatedAt ?? new Date();
      return PosCashPaymentResultRes.of(
        orderId,
        'PAID',
        'PAID',
        amountToPay,
        amountToPay,
        0,
        paidAt,
        tickets,
      );
    }

    const statusSummary = await this.checkPaymentStatus(orderId);

    if (
      statusSummary.status === PaymentStatus.SUCCESS ||
      (statusSummary.status as string) === 'SUCCESS'
    ) {
      const { tickets, paidAt } = await this.orderService.fulfillOrderPayment(
        orderId,
        statusSummary.paymentId,
        {
          paymentMethod: statusSummary.method || 'QR',
          branchId: staffContext.branchId,
          staffId: staffContext.staffId,
        },
      );

      return PosCashPaymentResultRes.of(
        orderId,
        statusSummary.paymentId,
        'PAID',
        amountToPay,
        amountToPay,
        0,
        paidAt,
        tickets,
      );
    }

    return PosQrPaymentRes.of(
      orderId,
      statusSummary.paymentId,
      statusSummary.amount,
      statusSummary.method,
      statusSummary.status,
      '',
      '',
    );
  }
}
