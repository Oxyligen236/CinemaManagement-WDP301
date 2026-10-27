"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Ticket,
  ChevronRight,
  Home,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Film,
  Building2,
  Calendar,
  Popcorn,
  ShieldCheck,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import { bookingApi } from "@/lib/api/booking.api";
import { orderApi } from "@/lib/api/order.api";
import type { BookingSummary } from "@/lib/types/booking.types";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

export default function BookingSummaryPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();

  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Promotion state
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Payment Gateway Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"VNPAY" | "MOMO" | "CARD">(
    "VNPAY",
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const isExpired = summary?.status === "EXPIRED";

  const fetchSummary = useCallback(async () => {
    try {
      const data = await bookingApi.getBookingSummary(orderId);
      setSummary(data);
      if (data.promotion?.promotionCode && !promoCode) {
        setPromoCode(data.promotion.promotionCode);
      }

      if (data.status === "EXPIRED") {
        setSecondsLeft(0);
        return;
      }

      if (data.expiresAt) {
        const remaining = Math.max(
          0,
          Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000),
        );
        setSecondsLeft(remaining);
      } else if (typeof data.remainingSeconds === "number") {
        setSecondsLeft(Math.max(0, data.remainingSeconds));
      }
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, "Không thể tải thông tin đặt vé"));
    }
  }, [orderId, promoCode]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialSummary = async () => {
      try {
        const data = await bookingApi.getBookingSummary(orderId);
        if (!isMounted) return;

        setSummary(data);
        if (data.promotion?.promotionCode) {
          setPromoCode(data.promotion.promotionCode);
        }

        if (data.status === "EXPIRED") {
          setSecondsLeft(0);
          return;
        }

        if (data.expiresAt) {
          const remaining = Math.max(
            0,
            Math.floor(
              (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
            ),
          );
          setSecondsLeft(remaining);
        } else if (typeof data.remainingSeconds === "number") {
          setSecondsLeft(Math.max(0, data.remainingSeconds));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          getFriendlyErrorMessage(err, "Không thể tải thông tin đặt vé"),
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialSummary();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || isExpired) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          void fetchSummary();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isExpired, fetchSummary]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleApplyPromotion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = promoCode.trim();
    if (!code) {
      setPromoFeedback({
        type: "error",
        message: "Vui lòng nhập mã giảm giá",
      });
      return;
    }

    try {
      setPromoLoading(true);
      setPromoFeedback(null);
      const updatedSummary = await orderApi.applyPromotion(orderId, code);
      setSummary(updatedSummary);
      const discount = updatedSummary.promotion?.discountAmount ?? 0;
      setPromoFeedback({
        type: "success",
        message: `Áp dụng mã ${code.toUpperCase()} thành công! Bạn được giảm ${formatCurrency(discount)}.`,
      });
    } catch (err: unknown) {
      const message = getFriendlyErrorMessage(
        err,
        "Thông tin không hợp lệ, vui lòng kiểm tra lại.",
      );
      setPromoFeedback({
        type: "error",
        message,
      });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleProceedPayment = async () => {
    setIsProcessingPayment(true);
    try {
      // Giả lập giao tiếp xác thực bảo mật với cổng thanh toán đối tác
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPaymentSuccess(true);
      setTimeout(() => {
        router.push("/profile/orders");
      }, 1200);
    } catch {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#dad2b4] border-t-[#da291c]" />
        <p className="mt-3 text-[14px] text-[#6f6247] font-semibold">
          Đang tải thông tin đơn đặt vé Lotte Cinema...
        </p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-2xl mx-auto bg-white border-2 border-[#dad2b4] p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-3 text-[#da291c]">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-[17px] font-bold text-[#231f20]">
              Lỗi đơn hàng đặt vé
            </h1>
            <p className="mt-1 text-[13px] text-[#666]">
              {error || "Không tìm thấy thông tin đơn hàng."}
            </p>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[#efebdb] flex justify-end">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center bg-[#da291c] hover:bg-[#b91c1c] px-6 text-[13px] font-bold text-white transition-colors uppercase tracking-wider"
          >
            Về trang chủ Lotte Cinema
          </Link>
        </div>
      </div>
    );
  }

  const isCriticalTime =
    secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 60;

  const seatsSubtotal = (summary.seats || []).reduce(
    (acc, s) => acc + (s.price || 0),
    0,
  );
  const productsSubtotal = (summary.products || []).reduce(
    (acc, p) => acc + (p.subTotal ?? p.unitPrice * p.quantity),
    0,
  );
  const subtotal = seatsSubtotal + productsSubtotal;

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-[12px] text-[#6f6247] select-none">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-[#da291c] hover:underline"
        >
          <Home className="h-3.5 w-3.5 text-[#da291c]" />
          <span>Trang chủ</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-[#dad2b4]" />
        <span>Đặt vé trực tuyến</span>
        <ChevronRight className="h-3 w-3 text-[#dad2b4]" />
        <span className="font-bold text-[#231f20]">
          Bước 2: Xác nhận đơn & Giảm giá
        </span>
      </div>

      {/* 2. Step Flow Indicator */}
      <div className="bg-white border border-[#dad2b4] p-3 sm:p-4 shadow-xs select-none">
        <div className="grid grid-cols-3 gap-2 text-center text-[12px] sm:text-[13px]">
          <div className="flex items-center justify-center gap-1.5 py-1 text-[#6f6247]">
            <CheckCircle2 className="h-4 w-4 text-[#15803d]" />
            <span className="font-semibold hidden sm:inline">
              1. Chọn suất & ghế
            </span>
            <span className="font-semibold sm:hidden">1. Chọn ghế</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 bg-[#efebdb] border border-[#dad2b4] text-[#da291c] font-bold">
            <span className="h-4 w-4 rounded-full bg-[#da291c] text-white text-[10px] flex items-center justify-center font-bold">
              2
            </span>
            <span className="hidden sm:inline">2. Xác nhận đơn & Giảm giá</span>
            <span className="sm:hidden">2. Xác nhận</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 text-[#999]">
            <span className="h-4 w-4 rounded-full bg-[#e5e7eb] text-[#888] text-[10px] flex items-center justify-center font-bold">
              3
            </span>
            <span className="font-semibold hidden sm:inline">
              3. Thanh toán vé
            </span>
            <span className="font-semibold sm:hidden">3. Thanh toán</span>
          </div>
        </div>
      </div>

      {/* 3. Top Order Meta & Countdown Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Order Identifier */}
        <div className="bg-white border border-[#dad2b4] p-4 flex flex-col justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              Mã đơn hàng giữ chỗ
            </p>
            <p className="text-[18px] font-black text-[#231f20] mt-0.5 tracking-wide">
              #{summary.orderId.slice(-8).toUpperCase()}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#efebdb] flex items-center justify-between">
            <span className="text-[12px] text-[#6f6247]">Trạng thái:</span>
            <span
              className={`text-[11px] font-bold uppercase px-2 py-0.5 ${
                isExpired
                  ? "bg-[#fff5f5] text-[#b91c1c] border border-[#fecaca]"
                  : "bg-[#fef3c7] text-[#b45309] border border-[#fcd34d]"
              }`}
            >
              {isExpired ? "HẾT HẠN GIỮ CHỖ" : "CHỜ THANH TOÁN (PENDING)"}
            </span>
          </div>
        </div>

        {/* Countdown Box */}
        <div
          className={`md:col-span-2 border-2 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs ${
            isExpired
              ? "bg-[#fff5f5] border-[#da291c] text-[#b91c1c]"
              : isCriticalTime
                ? "bg-[#fff1f1] border-[#da291c] animate-pulse text-[#da291c]"
                : "bg-[#fffaf0] border-[#f59e0b] text-[#78350f]"
          }`}
        >
          {isExpired ? (
            <div className="text-left w-full">
              <div className="flex items-center gap-2 text-[#da291c]">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-[15px] font-bold uppercase">
                  Đơn đặt vé đã hết hạn giữ chỗ
                </p>
              </div>
              <p className="mt-1 text-[12px] text-[#666]">
                Các vị trí ghế bạn chọn đã được hệ thống tự động giải phóng. Vui
                lòng quay lại sơ đồ để thực hiện đặt vé lại.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 flex items-center justify-center rounded-full border-2 ${
                    isCriticalTime
                      ? "bg-[#da291c] border-[#da291c] text-white"
                      : "bg-white border-[#f59e0b] text-[#da291c]"
                  }`}
                >
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                    Thời gian giữ chỗ còn lại:
                  </p>
                  <p className="text-[12px] text-[#777]">
                    Ghế sẽ tự động hủy khi đồng hồ về 00:00
                  </p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <span
                  className={`font-black text-[32px] sm:text-[36px] tracking-tight font-mono ${
                    isCriticalTime ? "text-[#da291c]" : "text-[#da291c]"
                  }`}
                >
                  {secondsLeft !== null ? formatTimer(secondsLeft) : "--:--"}
                </span>
                {isCriticalTime && (
                  <p className="text-[11px] font-bold text-[#da291c] uppercase">
                    Sắp hết thời gian giữ ghế!
                  </p>
                )}
              </div>
            </>
          )}

          {isExpired && (
            <button
              type="button"
              onClick={() => {
                if (summary.showtimeId) {
                  router.push(`/booking/${summary.showtimeId}`);
                } else {
                  router.push("/");
                }
              }}
              className="shrink-0 h-10 px-5 bg-[#da291c] hover:bg-[#b91c1c] text-white text-[13px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Đặt vé lại</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cinema & Screening Details Card */}
          <div className="bg-white border border-[#dad2b4] shadow-xs">
            <div className="bg-[#231f20] text-white px-5 py-3 border-b-2 border-[#da291c] flex items-center justify-between">
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-[#efebdb]">
                Thông tin suất chiếu & Rạp
              </h2>
              <span className="text-[11px] text-[#c1b687]">
                Hệ thống rạp chiếu Lotte Cinema
              </span>
            </div>

            <div className="p-5 space-y-4 text-[13px]">
              <div className="flex items-start gap-3 pb-3 border-b border-[#efebdb]">
                <Film className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                      Tên phim
                    </p>
                    <p className="font-bold text-[#231f20] text-[15px]">
                      {summary.movieName || "Phim điện ảnh chiếu rạp"}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-[#efebdb] text-[#6f6247] border border-[#dad2b4] w-fit">
                    Định dạng 2D
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-[#efebdb]">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                      Rạp & Phòng chiếu
                    </p>
                    <p className="font-bold text-[#231f20]">
                      Lotte Cinema Nam Sài Gòn
                    </p>
                    <p className="text-[12px] text-[#666]">
                      {summary.roomName || "Phòng chiếu tiêu chuẩn"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                      Suất chiếu
                    </p>
                    <p className="font-bold text-[#231f20]">
                      {summary.startTime
                        ? formatDateTime(summary.startTime)
                        : formatDateTime(summary.createdAt)}
                    </p>
                    <p className="text-[12px] text-[#666]">
                      Giữ chỗ đến: {formatDateTime(summary.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reserved Seats List */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="h-4 w-4 text-[#da291c]" />
                  <p className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247]">
                    Danh sách ghế đặt ({summary.seats?.length || 0} ghế):
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.seats && summary.seats.length > 0 ? (
                    summary.seats.map((seat) => (
                      <span
                        key={seat.seatShowtimeId}
                        className="inline-flex items-center gap-1.5 bg-[#fcfbfa] border border-[#dad2b4] px-3 py-1.5 text-[12px]"
                      >
                        <span className="font-bold text-[#da291c]">
                          {seat.rowPosition && seat.columnPosition
                            ? `${seat.rowPosition}${seat.columnPosition}`
                            : seat.seatShowtimeId.slice(-6)}
                        </span>
                        <span className="text-[#9d9580]">|</span>
                        <span className="font-semibold text-[#231f20]">
                          {formatCurrency(seat.price)}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-[#999] italic">
                      Không có thông tin ghế
                    </span>
                  )}
                </div>
              </div>

              {/* Products / Concessions if any */}
              {summary.products && summary.products.length > 0 && (
                <div className="pt-3 border-t border-[#efebdb]">
                  <div className="flex items-center gap-2 mb-2">
                    <Popcorn className="h-4 w-4 text-[#da291c]" />
                    <p className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247]">
                      Bắp nước / Combo:
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {summary.products.map((p) => (
                      <div
                        key={p.productId}
                        className="flex justify-between items-center text-[12px] bg-[#fcfbfa] border border-[#efebdb] p-2"
                      >
                        <span className="font-semibold text-[#231f20]">
                          {p.productName || "Sản phẩm"}{" "}
                          <span className="text-[#da291c]">x{p.quantity}</span>
                        </span>
                        <span className="font-bold text-[#6f6247]">
                          {formatCurrency(p.unitPrice * p.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Promotion / Voucher Section */}
          <div className="bg-white border border-[#dad2b4] p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-[#da291c]" />
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-[#231f20]">
                Mã khuyến mại / Phiếu giảm giá (Voucher)
              </h2>
            </div>
            <p className="text-[12px] text-[#666] mb-3">
              Nhập mã giảm giá của Lotte Cinema hoặc mã đối tác để nhận ưu đãi
              thanh toán vé.
            </p>

            <form
              onSubmit={handleApplyPromotion}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                disabled={isExpired || promoLoading}
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  if (promoFeedback) setPromoFeedback(null);
                }}
                placeholder="NHẬP MÃ GIẢM GIÁ (VÍ DỤ: SALE20)"
                className="h-11 flex-1 border border-[#dad2b4] bg-white px-3.5 text-[13px] uppercase tracking-wider text-[#231f20] placeholder:text-[#999] focus:border-[#da291c] focus:outline-hidden disabled:bg-[#f5f5f5] disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isExpired || promoLoading || !promoCode.trim()}
                className="h-11 px-6 bg-[#efebdb] hover:bg-[#dad2b4] border border-[#dad2b4] text-[#231f20] font-bold text-[13px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {promoLoading ? "Đang kiểm tra..." : "Áp dụng mã"}
              </button>
            </form>

            {promoFeedback && (
              <div
                className={`mt-3 border p-3 text-[12px] font-semibold flex items-center gap-2 ${
                  promoFeedback.type === "success"
                    ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
                    : "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
                }`}
              >
                {promoFeedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{promoFeedback.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Price Breakdown & Actions */}
        <div className="space-y-6">
          <div className="bg-white border-2 border-[#dad2b4] shadow-xs overflow-hidden">
            <div className="bg-[#efebdb] border-b border-[#dad2b4] px-5 py-3.5 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#da291c]" />
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#231f20]">
                Tổng quan thanh toán
              </h3>
            </div>

            <div className="p-5 space-y-3.5 text-[13px]">
              <div className="flex justify-between items-center text-[#666]">
                <span>Tạm tính tiền vé & bắp nước:</span>
                <span className="font-semibold text-[#231f20]">
                  {formatCurrency(subtotal > 0 ? subtotal : summary.totalAmount)}
                </span>
              </div>

              {summary.promotion && summary.promotion.discountAmount > 0 && (
                <div className="flex justify-between items-center text-[#15803d] font-semibold bg-[#f0fdf4] p-2 border border-[#bbf7d0]">
                  <span>
                    Giảm giá voucher ({summary.promotion.promotionCode}):
                  </span>
                  <span>-{formatCurrency(summary.promotion.discountAmount)}</span>
                </div>
              )}

              <div className="pt-3 border-t-2 border-[#dad2b4] flex justify-between items-baseline">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247]">
                    Số tiền cần thanh toán
                  </p>
                  <p className="text-[11px] text-[#999]">
                    (Đã bao gồm thuế GTGT)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[26px] font-black text-[#da291c] leading-none">
                    {formatCurrency(summary.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Security info */}
              <div className="pt-3 border-t border-[#efebdb] flex items-center gap-2 text-[11px] text-[#6f6247]">
                <ShieldCheck className="h-4 w-4 text-[#15803d] shrink-0" />
                <span>
                  Giao dịch bảo mật theo chuẩn Lotte Cinema Payment Gateway
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full h-12 bg-[#da291c] hover:bg-[#b91c1c] text-white font-bold text-[14px] uppercase tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-[#ccc] cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Tiến hành thanh toán ngay</span>
                </button>

                <Link
                  href="/"
                  className="w-full h-10 bg-[#efebdb] hover:bg-[#dad2b4] border border-[#dad2b4] text-[#231f20] font-semibold text-[13px] flex items-center justify-center transition-colors"
                >
                  Về trang chủ Lotte Cinema
                </Link>
              </div>
            </div>
          </div>

          {/* Booking Policy Tips */}
          <div className="bg-[#fcfbfa] border border-[#dad2b4] p-4 text-[12px] text-[#666] space-y-2">
            <p className="font-bold text-[#231f20] uppercase text-[11px] tracking-wider">
              Lưu ý đặt vé online:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Vé đã đặt thành công không thể đổi hoặc hủy theo quy định của
                rạp.
              </li>
              <li>
                Vui lòng đến rạp trước giờ chiếu tối thiểu 15 phút để nhận vé
                hoặc quét mã vào phòng chiếu.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lotte Cinema Payment Gateway Modal */}
      {isPaymentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-['Arial',sans-serif]"
        >
          <div className="relative w-full max-w-lg bg-[#fcfbfa] border-2 border-[#231f20] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#da291c] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#fecaca]">
                    LOTTE CINEMA GATEWAY
                  </p>
                  <h3 className="text-[16px] font-bold uppercase tracking-wide">
                    Xác nhận & Thanh toán đơn hàng
                  </h3>
                </div>
              </div>
              {!isProcessingPayment && !paymentSuccess && (
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-1 hover:bg-[#b82116] rounded transition-colors cursor-pointer text-white"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              )}
            </div>

            {paymentSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-[#dcfce7] rounded-full flex items-center justify-center mx-auto text-[#15803d]">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h4 className="text-[18px] font-bold text-[#231f20]">
                    Thanh toán thành công!
                  </h4>
                  <p className="mt-1 text-[13px] text-[#666]">
                    Giao dịch đã được ghi nhận vào hệ thống Lotte Cinema.
                  </p>
                  <p className="mt-2 text-[12px] font-semibold text-[#da291c]">
                    Đang chuyển tiếp tới Lịch sử đơn hàng để lấy mã vé & QR
                    check-in...
                  </p>
                </div>
                <div className="pt-2">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#da291c] border-t-transparent" />
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Order Summary Strip */}
                <div className="bg-[#efebdb] border border-[#dad2b4] p-4 space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6f6247]">Mã đơn hàng:</span>
                    <span className="font-mono font-bold text-[#231f20]">
                      #{orderId.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6f6247]">Phim:</span>
                    <span className="font-bold text-[#231f20] truncate max-w-[260px]">
                      {summary.movieName || "Vé xem phim Lotte Cinema"}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#dad2b4] flex justify-between items-baseline">
                    <span className="text-[13px] font-bold text-[#231f20] uppercase">
                      Tổng thanh toán:
                    </span>
                    <span className="text-[22px] font-black text-[#da291c]">
                      {formatCurrency(summary.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#231f20] mb-2.5">
                    Chọn phương thức thanh toán:
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center justify-between p-3 border cursor-pointer transition-colors ${
                        paymentMethod === "VNPAY"
                          ? "border-[#da291c] bg-[#fef2f2]"
                          : "border-[#dad2b4] bg-white hover:bg-[#faf9f6]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="VNPAY"
                          checked={paymentMethod === "VNPAY"}
                          onChange={() => setPaymentMethod("VNPAY")}
                          className="accent-[#da291c]"
                        />
                        <div>
                          <p className="text-[13px] font-bold text-[#231f20]">
                            Cổng VNPAY (QR Pay / Mobile Banking)
                          </p>
                          <p className="text-[11px] text-[#666]">
                            Quét mã VNPAY QR qua ứng dụng của hơn 30 ngân hàng
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 border border-[#dad2b4] bg-white text-[#231f20] font-semibold text-[13px] hover:bg-[#dad2b4] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={handleProceedPayment}
                    className="px-6 py-2 bg-[#da291c] hover:bg-[#b82116] text-white font-bold text-[13px] uppercase tracking-wide transition-colors cursor-pointer disabled:bg-[#ccc] flex items-center gap-2"
                  >
                    {isProcessingPayment ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Đang xử lý giao dịch...</span>
                      </>
                    ) : (
                      <span>Xác nhận thanh toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
