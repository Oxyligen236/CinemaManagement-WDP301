export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';

export interface OrderItemProduct {
  productId: string;
  productName: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
}

export interface OrderItemTicket {
  ticketId: string;
  ticketCode: string;
  price: number;
  ticketStatus: TicketStatus;
  usedAt?: string;
  movieTitle: string;
  roomName: string;
  seatLabel: string;
  startTime: string;
  endTime?: string;
}

export interface PromotionSummary {
  promotionId: string;
  promotionCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmount: number;
}

export interface OrderSummary {
  orderId: string;
  userId: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  ticketCount: number;
  hasProducts: boolean;
}

export interface OrderDetail {
  orderId: string;
  userId: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  tickets: OrderItemTicket[];
  products: OrderItemProduct[];
  promotion?: PromotionSummary;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QueryMyOrdersDto {
  page?: number;
  limit?: number;
  status?: OrderStatus | string;
}

export interface QueryStaffOrdersDto {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  date?: string;
}

export interface QueryAdminOrdersDto {
  page?: number;
  limit?: number;
  userId?: string;
  status?: OrderStatus;
  fromDate?: string;
  toDate?: string;
}

export interface ScanTicketDto {
  ticketCode: string;
  showtimeId?: string;
}

export interface ScanTicketResult {
  ticketId: string;
  ticketCode: string;
  price: number;
  ticketStatus: TicketStatus;
  usedAt?: string;
  movieTitle: string;
  roomName: string;
  seatLabel: string;
  startTime: string;
  endTime: string;
  scannedBy: string;
  scannedAt: string;
  message: string;
}
