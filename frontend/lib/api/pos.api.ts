import { ApiError } from "./order.api";
import { getFriendlyErrorMessage } from "../utils/error-handler";
import type { PromotionSummary } from "../types/order.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("cinema_access_token") ||
    sessionStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorMessage = "Yêu cầu không thành công";
      let errorData;
      try {
        errorData = await res.json();
        if (errorData?.message) {
          errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(", ")
            : errorData.message;
        }
      } catch {
        // Not JSON
      }
      const friendlyMessage = getFriendlyErrorMessage({
        status: res.status,
        message: errorMessage,
      });
      throw new ApiError(friendlyMessage, res.status, errorData);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Lỗi kết nối máy chủ";
    throw new ApiError(message);
  }
}

// Types
export interface PosItem {
  itemId: string;
  name: string;
  category: string;
  size?: string | null;
  price: number;
  stockQuantity: number;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;
}

export interface PosComboItem {
  itemId: string;
  name: string;
  quantity: number;
}

export interface PosCombo {
  comboId: string;
  name: string;
  price: number;
  availableStock: number;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  items: PosComboItem[];
}

export interface PosConcessionCatalog {
  branchId: string;
  items: PosItem[];
  combos: PosCombo[];
}

export interface PosShowtime {
  showtimeId: string;
  movieId: string;
  movieTitle?: string;
  moviePosterUrl?: string;
  roomId: string;
  roomName?: string;
  branchId?: string;
  branchName?: string;
  startTime: string;
  endTime?: string;
  basePrice: number;
  format?: string;
  subtitleType?: string;
  availableSeats?: number;
  totalSeats?: number;
}

export interface PosSeatShowtime {
  seatShowtimeId: string;
  showtimeId: string;
  seatId: string;
  seatStatus: "EMPTY" | "RESERVED" | "BOOKED";
  rowPosition: string;
  columnPosition: number;
  seatType: string;
  price?: number;
}

export interface CreatePosOrderReq {
  showtimeId?: string;
  seatShowtimeIds?: string[];
  products?: { productId: string; quantity: number }[];
}

export interface PosBookingSummary {
  orderId: string;
  orderCode?: string;
  totalAmount: number;
  expiresAt: string;
  remainingSeconds: number;
  seats: Array<{
    seatShowtimeId: string;
    seatId?: string;
    rowPosition?: string;
    columnPosition?: number;
    seatType?: string;
    price: number;
  }>;
  products: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    subTotal?: number;
  }>;
  showtimeId?: string;
  movieName?: string;
  roomName?: string;
  startTime?: string;
  promotion?: PromotionSummary;
}

export interface ConfirmCashPaymentReq {
  cashReceived: number;
}

export interface PosReceiptTicket {
  ticketCode: string;
  seatName?: string;
  seatLabel?: string;
  seatType?: string;
  movieTitle?: string;
  roomName?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  price: number;
  qrCodeUrl?: string;
}

export interface PosCashPaymentResult {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
  status: string;
  tickets: PosReceiptTicket[];
}

export interface InitiateQrPaymentReq {
  paymentMethod: "VNPAY" | "MOMO" | "ZALOPAY";
}

export interface PosQrPaymentRes {
  orderId: string;
  qrCodeUrl: string;
  qrCodeString?: string;
  transactionCode: string;
  amount: number;
  paymentMethod: string;
}

export interface PosPaymentStatusRes {
  orderId: string;
  status: string;
  isPaid: boolean;
  tickets?: PosReceiptTicket[];
}

export interface PosReceiptRes {
  orderId: string;
  orderCode?: string;
  branchName: string;
  branchAddress: string;
  cashierName?: string;
  staffName?: string;
  printedAt: string;
  movieTitle?: string;
  roomName?: string;
  showDate?: string;
  showtime?: string;
  seats?: Array<{
    seatName: string;
    seatType: string;
    price: number;
  }>;
  concessions?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
  }>;
  products?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
  }>;
  subtotal?: number;
  discount?: number;
  totalAmount: number;
  paymentMethod: string;
  cashReceived?: number;
  changeAmount?: number;
  tickets: PosReceiptTicket[];
}

export const posApi = {
  // Lấy danh mục bắp nước & combo quầy
  getStaffProducts: (): Promise<PosConcessionCatalog> => {
    return request<PosConcessionCatalog>("/staff/products");
  },

    // Lấy danh sách suất chiếu hôm nay cho nhân viên tại quầy
  getTodayShowtimes: async (branchId?: string): Promise<PosShowtime[]> => {
    try {
      // 1. Thử gọi endpoint chuyên biệt của Staff (tự động nhận diện branchId qua token)
      const res = await request<PosShowtime[] | { items?: PosShowtime[] }>(
        "/staff/showtimes/today",
      );
      if (Array.isArray(res)) return res;
      if (res && "items" in res && Array.isArray(res.items)) return res.items;
      return [];
    } catch {
      // 2. Fallback sang /showtimes/public có branchId cụ thể (TUYỆT ĐỐI KHÔNG query khi thiếu branchId)
      if (!branchId) return [];
      const today = new Date().toISOString().split("T")[0];
      try {
        const res = await request<PosShowtime[] | { items?: PosShowtime[] }>(
          `/showtimes/public?branchId=${encodeURIComponent(branchId)}&date=${today}`,
        );
        if (Array.isArray(res)) return res;
        if (res && "items" in res && Array.isArray(res.items)) return res.items;
        return [];
      } catch {
        return [];
      }
    }
  },

  // Lấy sơ đồ ghế theo suất chiếu
  getShowtimeSeats: (showtimeId: string): Promise<PosSeatShowtime[]> => {
    return request<PosSeatShowtime[]>(
      `/showtimes/${encodeURIComponent(showtimeId)}/seats`,
    );
  },

  // Tạo đơn giữ chỗ tại quầy
  createPosOrder: (payload: CreatePosOrderReq): Promise<PosBookingSummary> => {
    return request<PosBookingSummary>("/staff/pos/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Áp dụng khuyến mãi / voucher
  applyPromotion: (
    orderId: string,
    promotionCode: string,
  ): Promise<PosBookingSummary> => {
    return request<PosBookingSummary>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/apply-promotion`,
      {
        method: "POST",
        body: JSON.stringify({ promotionCode }),
      },
    );
  },

  // Hủy đơn quầy (nhả ghế ngay lập tức)
  cancelPosOrder: (
    orderId: string,
    reason?: string,
  ): Promise<{ message: string; orderId: string; status: string }> => {
    return request<{ message: string; orderId: string; status: string }>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason || "Khách hủy tại quầy" }),
      },
    );
  },

  // Thu tiền mặt & in vé
  confirmCashPayment: (
    orderId: string,
    payload: ConfirmCashPaymentReq,
  ): Promise<PosCashPaymentResult> => {
    return request<PosCashPaymentResult>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/pay/cash`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  // Khởi tạo thanh toán QR
  initiateQrPayment: (
    orderId: string,
    payload: InitiateQrPaymentReq,
  ): Promise<PosQrPaymentRes> => {
    return request<PosQrPaymentRes>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/pay/qr`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  // Kiểm tra trạng thái thanh toán QR
  checkPaymentStatus: (orderId: string): Promise<PosPaymentStatusRes> => {
    return request<PosPaymentStatusRes>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/pay/status`,
    );
  },

  // Lấy dữ liệu hóa đơn in nhiệt 80mm
  getReceipt: (orderId: string): Promise<PosReceiptRes> => {
    return request<PosReceiptRes>(
      `/staff/pos/orders/${encodeURIComponent(orderId)}/receipt`,
    );
  },
};
