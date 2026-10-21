import { OrderStatus } from '../../domain/enums/order-status.enum';

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
    res.orderId = orderId;
    res.userId = userId;
    res.totalAmount = totalAmount;
    res.status = status;
    res.createdAt = createdAt;
    res.ticketCount = ticketCount;
    res.hasProducts = hasProducts;
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
    res.productId = productId;
    res.productName = productName;
    res.imageUrl = imageUrl;
    res.quantity = quantity;
    res.unitPrice = unitPrice;
    res.subTotal = subTotal;
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
    res.ticketId = ticketId;
    res.ticketCode = ticketCode;
    res.price = price;
    res.ticketStatus = ticketStatus;
    res.usedAt = usedAt;
    res.movieTitle = movieTitle;
    res.roomName = roomName;
    res.seatLabel = seatLabel;
    res.startTime = startTime;
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
    res.promotionId = promotionId;
    res.promotionCode = promotionCode;
    res.discountType = discountType;
    res.discountValue = discountValue;
    res.discountAmount = discountAmount;
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
    res.orderId = orderId;
    res.userId = userId;
    res.totalAmount = totalAmount;
    res.status = status;
    res.createdAt = createdAt;
    res.tickets = tickets;
    res.products = products;
    res.promotion = promotion;
    return res;
  }
}
