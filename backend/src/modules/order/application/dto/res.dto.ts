import { OrderStatus } from '../../domain/enums/order-status.enum';

export class OrderSummaryRes {
  orderId!: string;
  userId!: string;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: Date;
  ticketCount!: number;
  hasProducts!: boolean;

  static of(source: Record<string, any>): OrderSummaryRes {
    const res = new OrderSummaryRes();
    Object.assign(res, source);
    return res;
  }

  static ofArray(sources: Record<string, any>[] | null | undefined): OrderSummaryRes[] {
    return (sources ?? []).map((source) => OrderSummaryRes.of(source));
  }
}

export class OrderItemProductRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  quantity!: number;
  unitPrice!: number;
  subTotal!: number;

  static of(source: Record<string, any>): OrderItemProductRes {
    const res = new OrderItemProductRes();
    Object.assign(res, source);
    return res;
  }

  static ofArray(sources: Record<string, any>[] | null | undefined): OrderItemProductRes[] {
    return (sources ?? []).map((source) => OrderItemProductRes.of(source));
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

  static of(source: Record<string, any>): OrderItemTicketRes {
    const res = new OrderItemTicketRes();
    Object.assign(res, source);
    return res;
  }

  static ofArray(sources: Record<string, any>[] | null | undefined): OrderItemTicketRes[] {
    return (sources ?? []).map((source) => OrderItemTicketRes.of(source));
  }
}

export class PromotionSummaryRes {
  promotionId!: string;
  promotionCode!: string;
  discountType!: string;
  discountValue!: number;
  discountAmount!: number;

  static of(source: Record<string, any>): PromotionSummaryRes {
    const res = new PromotionSummaryRes();
    Object.assign(res, source);
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

  static of(source: Record<string, any>): OrderDetailRes {
    const res = new OrderDetailRes();
    Object.assign(res, source);
    res.tickets = OrderItemTicketRes.ofArray(source.tickets);
    res.products = OrderItemProductRes.ofArray(source.products);
    if (source.promotion) res.promotion = PromotionSummaryRes.of(source.promotion);
    return res;
  }
}
