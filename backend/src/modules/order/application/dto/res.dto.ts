import { OrderStatus } from '../../domain/enums/order-status.enum';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { PaymentMethod, PaymentStatus } from '../../contracts/payment.contract';

export class BookingSeatRes {
  seatShowtimeId!: string;
  seatId!: string;
  rowPosition!: string;
  columnPosition!: number;
  seatType!: string;
  price!: number;
}

export class BookingProductRes {
  productId!: string;
  productName!: string;
  quantity!: number;
  unitPrice!: number;
}

export class BookingSummaryRes {
  orderId!: string;
  userId!: string;
  status!: OrderStatus;
  totalAmount!: number;
  createdAt!: Date;
  expiresAt!: Date;
  remainingSeconds!: number;
  seats!: BookingSeatRes[];
  products!: BookingProductRes[];
  promotion?: PromotionSummaryRes;
}

export class ApplyPromotionRes {
  orderId!: string;
  userId!: string;
  status!: OrderStatus;
  totalAmount!: number;
  createdAt!: Date;
  expiresAt!: Date;
  remainingSeconds!: number;
  seats!: BookingSeatRes[];
  products!: BookingProductRes[];
  promotion?: PromotionSummaryRes;
}

export class CancelOrderRes {
  orderId!: string;
  status!: OrderStatus;
  message!: string;
  cancelledAt!: Date;

  static of(
    orderId: string,
    status: OrderStatus,
    message: string,
    cancelledAt: Date,
  ): CancelOrderRes {
    const res = new CancelOrderRes();
    Object.assign(res, { orderId, status, message, cancelledAt });
    return res;
  }
}

export class OrderSummaryRes {
  orderId!: string;
  userId!: string;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: Date;
  ticketCount!: number;
  hasProducts!: boolean;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;

  static of(
    orderId: string,
    userId: string,
    totalAmount: number,
    status: OrderStatus,
    createdAt: Date,
    ticketCount: number,
    hasProducts: boolean,
    branchId?: string,
    branchName?: string,
    branchAddress?: string,
  ): OrderSummaryRes {
    const res = new OrderSummaryRes();
    Object.assign(res, {
      orderId,
      userId,
      totalAmount,
      status,
      createdAt,
      ticketCount,
      hasProducts,
      branchId,
      branchName,
      branchAddress,
    });
    return res;
  }
}

export class OrderItemProductRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  quantity!: number;
  unitPrice!: number;
  subTotal!: number;

  static of(
    productId: string,
    productName: string,
    imageUrl: string | undefined,
    quantity: number,
    unitPrice: number,
    subTotal: number,
  ): OrderItemProductRes {
    const res = new OrderItemProductRes();
    Object.assign(res, {
      productId,
      productName,
      imageUrl,
      quantity,
      unitPrice,
      subTotal,
    });
    return res;
  }
}

export class OrderItemTicketRes {
  ticketId!: string;
  ticketCode!: string;
  price!: number;
  ticketStatus!: string;
  usedAt?: Date;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime?: Date;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;

  static of(
    ticketId: string,
    ticketCode: string,
    price: number,
    ticketStatus: string,
    usedAt: Date | undefined,
    movieTitle: string,
    roomName: string,
    seatLabel: string,
    startTime: Date,
    endTime?: Date,
    branchId?: string,
    branchName?: string,
    branchAddress?: string,
  ): OrderItemTicketRes {
    const res = new OrderItemTicketRes();
    Object.assign(res, {
      ticketId,
      ticketCode,
      price,
      ticketStatus,
      usedAt,
      movieTitle,
      roomName,
      seatLabel,
      startTime,
      endTime,
      branchId,
      branchName,
      branchAddress,
    });
    return res;
  }
}

export class PromotionSummaryRes {
  promotionId!: string;
  promotionCode!: string;
  discountType!: string;
  discountValue!: number;
  discountAmount!: number;

  static of(
    promotionId: string,
    promotionCode: string,
    discountType: string,
    discountValue: number,
    discountAmount: number,
  ): PromotionSummaryRes {
    const res = new PromotionSummaryRes();
    Object.assign(res, {
      promotionId,
      promotionCode,
      discountType,
      discountValue,
      discountAmount,
    });
    return res;
  }
}

export class OrderDetailRes {
  orderId!: string;
  userId!: string;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: Date;
  tickets!: OrderItemTicketRes[];
  products!: OrderItemProductRes[];
  promotion?: PromotionSummaryRes;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;

  static of(
    orderId: string,
    userId: string,
    totalAmount: number,
    status: OrderStatus,
    createdAt: Date,
    tickets: OrderItemTicketRes[],
    products: OrderItemProductRes[],
    promotion?: PromotionSummaryRes,
    branchId?: string,
    branchName?: string,
    branchAddress?: string,
  ): OrderDetailRes {
    const res = new OrderDetailRes();
    Object.assign(res, {
      orderId,
      userId,
      totalAmount,
      status,
      createdAt,
      tickets,
      products,
      promotion,
      branchId,
      branchName,
      branchAddress,
    });
    return res;
  }
}

export class PosBookingSummaryRes {
  orderId!: string;
  userId!: string;
  status!: OrderStatus;
  totalAmount!: number;
  createdAt!: Date;
  expiresAt!: Date;
  remainingSeconds!: number;
  seats!: BookingSeatRes[];
  products!: BookingProductRes[];
  promotion?: PromotionSummaryRes;
}

export class PosCashPaymentResultRes {
  orderId!: string;
  paymentId!: string;
  status!: OrderStatus;
  totalAmount!: number;
  cashReceived!: number;
  changeAmount!: number;
  paidAt!: Date;
  tickets!: TicketItemSummaryRes[];
}

export class PosQrPaymentRes {
  orderId!: string;
  paymentId!: string;
  amount!: number;
  paymentMethod!: PaymentMethod;
  paymentStatus!: PaymentStatus;
  qrCodeUrl!: string;
  qrPayload!: string;
}

export class PosReceiptTicketRes {
  ticketCode!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  seatName?: string;
  seatType?: string;
  startTime!: Date;
  endTime!: Date;
  price!: number;
}

export class PosReceiptSeatRes {
  seatName!: string;
  seatType!: string;
  price!: number;
}

export class PosReceiptItemRes {
  productName!: string;
  quantity!: number;
  unitPrice!: number;
  subTotal!: number;
}

export class PosReceiptRes {
  orderId!: string;
  orderCode?: string;
  branchName!: string;
  branchAddress!: string;
  staffName!: string;
  printedAt!: Date;
  paymentMethod!: string;
  totalAmount!: number;
  cashReceived?: number;
  changeAmount?: number;
  movieTitle?: string;
  roomName?: string;
  showtime?: string;
  showDate?: string;
  seats?: PosReceiptSeatRes[];
  tickets!: PosReceiptTicketRes[];
  products!: PosReceiptItemRes[];
}

export class TicketDetailRes {
  ticketId!: string;
  ticketCode!: string;
  orderId!: string;
  price!: number;
  ticketStatus!: TicketStatus;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;

  static of(
    ticketId: string,
    ticketCode: string,
    orderId: string,
    price: number,
    ticketStatus: TicketStatus,
    usedAt: Date | undefined,
    seatShowtimeId: string,
    movieTitle: string,
    roomName: string,
    seatLabel: string,
    startTime: Date,
    endTime: Date,
    branchId?: string,
    branchName?: string,
    branchAddress?: string,
  ): TicketDetailRes {
    const res = new TicketDetailRes();
    res.ticketId = ticketId;
    res.ticketCode = ticketCode;
    res.orderId = orderId;
    res.price = price;
    res.ticketStatus = ticketStatus;
    res.usedAt = usedAt;
    res.seatShowtimeId = seatShowtimeId;
    res.movieTitle = movieTitle;
    res.roomName = roomName;
    res.seatLabel = seatLabel;
    res.startTime = startTime;
    res.endTime = endTime;
    res.branchId = branchId;
    res.branchName = branchName;
    res.branchAddress = branchAddress;
    return res;
  }
}

export class ScanTicketResultRes {
  ticketId!: string;
  ticketCode!: string;
  orderId!: string;
  price!: number;
  ticketStatus!: TicketStatus;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;
  branchId!: string;
  branchName!: string;
  branchAddress?: string;
  scannedBy!: string;
  scannedAt!: Date;
  message!: string;

  static of(
    ticketId: string,
    ticketCode: string,
    orderId: string,
    price: number,
    ticketStatus: TicketStatus,
    usedAt: Date | undefined,
    seatShowtimeId: string,
    movieTitle: string,
    roomName: string,
    seatLabel: string,
    startTime: Date,
    endTime: Date,
    branchId: string,
    branchName: string,
    branchAddress: string | undefined,
    scannedBy: string,
    scannedAt: Date,
    message: string,
  ): ScanTicketResultRes {
    const res = new ScanTicketResultRes();
    res.ticketId = ticketId;
    res.ticketCode = ticketCode;
    res.orderId = orderId;
    res.price = price;
    res.ticketStatus = ticketStatus;
    res.usedAt = usedAt;
    res.seatShowtimeId = seatShowtimeId;
    res.movieTitle = movieTitle;
    res.roomName = roomName;
    res.seatLabel = seatLabel;
    res.startTime = startTime;
    res.endTime = endTime;
    res.branchId = branchId;
    res.branchName = branchName;
    res.branchAddress = branchAddress;
    res.scannedBy = scannedBy;
    res.scannedAt = scannedAt;
    res.message = message;
    return res;
  }
}

export class TicketItemSummaryRes {
  ticketId!: string;
  ticketCode!: string;
  price!: number;
  ticketStatus!: string;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
}
