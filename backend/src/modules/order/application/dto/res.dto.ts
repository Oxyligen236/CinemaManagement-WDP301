import { OrderStatus } from '../../domain/enums/order-status.enum';

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
  discountAmount!: number;
  promotionCode?: string;
  finalAmount?: number;
}

export class ApplyPromotionRes {
  orderId!: string;
  userId!: string;
  status!: OrderStatus;
  totalAmount!: number;
  discountAmount!: number;
  finalAmount!: number;
  promotionCode?: string;
  promotionId?: string;
  createdAt!: Date;
  expiresAt!: Date;
  remainingSeconds!: number;
  seats!: BookingSeatRes[];
  products!: BookingProductRes[];
}

export class OrderSummaryRes {
  orderId!: string;
  userId!: string;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: Date;
  ticketCount!: number;
  hasProducts!: boolean;

  static of(
    orderId: string,
    userId: string,
    totalAmount: number,
    status: OrderStatus,
    createdAt: Date,
    ticketCount: number,
    hasProducts: boolean,
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

  static of(
    orderId: string,
    userId: string,
    totalAmount: number,
    status: OrderStatus,
    createdAt: Date,
    tickets: OrderItemTicketRes[],
    products: OrderItemProductRes[],
    promotion?: PromotionSummaryRes,
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
    });
    return res;
  }
}
