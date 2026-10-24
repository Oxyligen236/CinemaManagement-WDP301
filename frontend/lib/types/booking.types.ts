export type SeatShowtimeStatus = 'EMPTY' | 'RESERVED' | 'BOOKED';

export interface SeatShowtime {
  seatShowtimeId: string;
  showtimeId: string;
  seatId: string;
  seatStatus: SeatShowtimeStatus;
  rowPosition: string;
  columnPosition: number;
  seatType: string;
}

export interface CreateBookingReq {
  showtimeId: string;
  seatShowtimeIds: string[];
  products?: { productId: string; quantity: number }[];
  promotionCode?: string;
}

export interface ApplyPromotionReq {
  promotionCode: string;
}

export interface BookingSeat {
  seatShowtimeId: string;
  seatId?: string;
  rowPosition?: string;
  columnPosition?: number;
  seatType?: string;
  price: number;
}

export interface BookingSummary {
  orderId: string;
  userId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  totalAmount: number;
  finalAmount?: number;
  promotionCode?: string;
  createdAt: string;
  expiresAt: string;
  remainingSeconds: number;
  seats: BookingSeat[];
  products: { productId: string; productName?: string; quantity: number; unitPrice: number; subTotal?: number }[];
  discountAmount: number;
  showtimeId?: string;
  movieName?: string;
  roomName?: string;
  startTime?: string;
}
