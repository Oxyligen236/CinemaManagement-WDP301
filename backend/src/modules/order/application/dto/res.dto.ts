import { OrderStatus } from '../../domain/enums/order-status.enum';

export class OrderSummaryRes {
  orderId!: string;
  userId!: string;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: Date;
  ticketCount!: number;
  hasProducts!: boolean;
}

export class OrderItemProductRes {
  productId!: string;
  productName!: string;
  imageUrl?: string;
  quantity!: number;
  unitPrice!: number;
  subTotal!: number;
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
}

export class PromotionSummaryRes {
  promotionId!: string;
  promotionCode!: string;
  discountType!: string;
  discountValue!: number;
  discountAmount!: number;
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
}
