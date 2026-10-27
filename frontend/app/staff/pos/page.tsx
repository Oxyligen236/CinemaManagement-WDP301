"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  posApi,
  type PosBookingSummary,
  type PosConcessionCatalog,
  type PosReceiptRes,
  type PosSeatShowtime,
  type PosShowtime,
} from "@/lib/api/pos.api";
import { ThermalReceiptModal } from "@/components/staff/pos/thermal-receipt-modal";
import { formatCurrency } from "@/lib/utils/formatters";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import {
  CalendarClock,
  Clock,
  CreditCard,
  History,
  MonitorPlay,
  Popcorn,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Ticket,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  X,
  Armchair,
  MapPin,
} from "lucide-react";

const BRANCH_NAMES: Record<string, string> = {
  "branch-cantavil": "Lotte Cinema Cantavil",
  "branch-govap": "Lotte Cinema Gò Vấp",
  "branch-nam-sai-gon": "Lotte Cinema Nam Sài Gòn",
  "branch-landmark": "Lotte Cinema Landmark Hà Nội",
};

type ActiveTab = "showtimes" | "seats" | "concessions";
type PaymentMethod = "CASH" | "QR";

interface SelectedProductCart {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isCombo: boolean;
  maxStock: number;
}

export default function StaffPosPage() {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>("showtimes");

  // Dữ liệu từ API
  const [showtimes, setShowtimes] = useState<PosShowtime[]>([]);
  const [catalog, setCatalog] = useState<PosConcessionCatalog | null>(null);
  const [seats, setSeats] = useState<PosSeatShowtime[]>([]);

  // Lựa chọn hiện tại
  const [selectedShowtime, setSelectedShowtime] = useState<PosShowtime | null>(
    null,
  );
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [productCart, setProductCart] = useState<
    Map<string, SelectedProductCart>
  >(new Map());

  // Khuyến mãi
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherApplied, setVoucherApplied] = useState<string | null>(null);

  // Đơn hàng PENDING hiện tại (đang giữ ghế)
  const [pendingOrder, setPendingOrder] = useState<PosBookingSummary | null>(
    null,
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [qrProvider, setQrProvider] = useState<"VNPAY" | "MOMO" | "ZALOPAY">(
    "VNPAY",
  );
  const [qrPaymentData, setQrPaymentData] = useState<{
    qrCodeUrl: string;
    transactionCode: string;
  } | null>(null);
  const [isQrChecking, setIsQrChecking] = useState(false);

  // Modal in hóa đơn nhiệt
  const [receiptData, setReceiptData] = useState<PosReceiptRes | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Dialog xác nhận hủy đơn
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Trạng thái loading / error
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Bộ lọc suất chiếu
  const [showtimeSearch, setShowtimeSearch] = useState("");

  // Clock thời gian thực trên header
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  const cashInputRef = useRef<HTMLInputElement>(null);

  // Cập nhật đồng hồ header
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setCurrentDate(now.toLocaleDateString("vi-VN"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Thông tin tài khoản nhân viên & chi nhánh
  const [staffUser, setStaffUser] = useState<{
    branchId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null>(null);

  // Đọc thông tin nhân viên từ localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cinema_user");
      if (raw) {
        setStaffUser(JSON.parse(raw));
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  // Tải danh sách suất chiếu & bắp nước ban đầu
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);

    let branchId: string | undefined;
    try {
      const raw = localStorage.getItem("cinema_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.branchId) {
          branchId = parsed.branchId;
          setStaffUser(parsed);
        }
      }
    } catch {
      // Ignore
    }

    try {
      const [showtimesRes, catalogRes] = await Promise.all([
        posApi.getTodayShowtimes(branchId),
        posApi.getStaffProducts().catch(() => null),
      ]);
      setShowtimes(showtimesRes);
      if (catalogRes) setCatalog(catalogRes);
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(
          err,
          "Không thể tải dữ liệu suất chiếu hoặc danh mục quầy",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadInitialData();
    })();
  }, [loadInitialData]);

  // Tải sơ đồ ghế khi chọn suất chiếu
  const loadSeatsForShowtime = useCallback(async (showtimeId: string) => {
    try {
      setErrorBanner(null);
      const seatList = await posApi.getShowtimeSeats(showtimeId);
      setSeats(seatList);
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(
          err,
          "Không thể tải sơ đồ ghế cho suất chiếu này",
        ),
      );
    }
  }, []);

  const handleSelectShowtime = (st: PosShowtime) => {
    if (pendingOrder) {
      setErrorBanner(
        "Bạn đang có đơn hàng giữ chỗ chưa hoàn tất. Vui lòng thanh toán hoặc hủy đơn trước.",
      );
      return;
    }
    setSelectedShowtime(st);
    setSelectedSeatIds([]);
    loadSeatsForShowtime(st.showtimeId);
    setActiveTab("seats");
  };

  // Chọn / bỏ chọn ghế
  const toggleSeat = (seat: PosSeatShowtime) => {
    if (seat.seatStatus !== "EMPTY") return;
    if (pendingOrder) {
      setErrorBanner(
        "Đơn hàng đã được tạo. Hãy hủy đơn nếu muốn chọn lại ghế.",
      );
      return;
    }

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.seatShowtimeId)) {
        return prev.filter((id) => id !== seat.seatShowtimeId);
      }
      if (prev.length >= 8) {
        alert("Tối đa chọn 8 ghế trong một đơn bán quầy");
        return prev;
      }
      return [...prev, seat.seatShowtimeId];
    });
  };

  // Thêm bắp nước / combo
  const updateProductQuantity = (
    item: {
      id: string;
      name: string;
      price: number;
      maxStock: number;
      isCombo: boolean;
    },
    delta: number,
  ) => {
    setProductCart((prev) => {
      const next = new Map(prev);
      const current = next.get(item.id);
      const currentQty = current ? current.quantity : 0;
      const nextQty = currentQty + delta;

      if (nextQty <= 0) {
        next.delete(item.id);
      } else {
        if (nextQty > item.maxStock) {
          alert(
            `Mặt hàng "${item.name}" chỉ còn ${item.maxStock} sản phẩm trong kho`,
          );
          return prev;
        }
        next.set(item.id, {
          productId: item.id,
          name: item.name,
          unitPrice: item.price,
          quantity: nextQty,
          isCombo: item.isCombo,
          maxStock: item.maxStock,
        });
      }
      return next;
    });
  };

  // Tính toán tiền tạm tính & ghế
  const selectedSeatObjects = useMemo(() => {
    const seatMap = new Map(seats.map((s) => [s.seatShowtimeId, s]));
    return selectedSeatIds
      .map((id) => seatMap.get(id))
      .filter(Boolean) as PosSeatShowtime[];
  }, [seats, selectedSeatIds]);

  const basePricePerSeat = selectedShowtime?.basePrice || 75000;

  const totalSeatsPrice = useMemo(() => {
    return selectedSeatObjects.reduce((sum, seat) => {
      let multiplier = 1;
      const type = (seat.seatType || "").toUpperCase();
      if (type.includes("VIP")) multiplier = 1.25;
      else if (type.includes("COUPLE") || type.includes("ĐÔI")) multiplier = 2;
      return sum + Math.round(basePricePerSeat * multiplier);
    }, 0);
  }, [selectedSeatObjects, basePricePerSeat]);

  const totalProductsPrice = useMemo(() => {
    let sum = 0;
    productCart.forEach((item) => {
      sum += item.unitPrice * item.quantity;
    });
    return sum;
  }, [productCart]);

  const subtotal = totalSeatsPrice + totalProductsPrice;
  const finalTotal = Math.max(0, subtotal - voucherDiscount);

  // Reset toàn bộ phiên làm việc để bán đơn mới
  const handleResetSession = useCallback(() => {
    setPendingOrder(null);
    setSelectedSeatIds([]);
    setProductCart(new Map());
    setVoucherCode("");
    setVoucherDiscount(0);
    setVoucherApplied(null);
    setCashReceived(0);
    setQrPaymentData(null);
    setRemainingSeconds(0);
    if (selectedShowtime) {
      loadSeatsForShowtime(selectedShowtime.showtimeId);
    }
  }, [selectedShowtime, loadSeatsForShowtime]);

  // Đếm ngược 10:00 giữ chỗ
  useEffect(() => {
    if (!pendingOrder || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          alert(
            "Đơn hàng giữ chỗ đã hết hạn 10 phút. Ghế đã được tự động nhả ra.",
          );
          handleResetSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingOrder, remainingSeconds, handleResetSession]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Tạo đơn giữ chỗ tại quầy
  const handleCreateBookingOrder = async () => {
    if (!selectedShowtime) {
      setErrorBanner("Vui lòng chọn suất chiếu trước khi đặt vé");
      return;
    }
    if (selectedSeatIds.length === 0) {
      setErrorBanner("Vui lòng chọn ít nhất 1 ghế xem phim");
      return;
    }

    setActionLoading(true);
    setErrorBanner(null);

    const productsPayload = Array.from(productCart.values()).map((p) => ({
      productId: p.productId,
      quantity: p.quantity,
    }));

    try {
      const res = await posApi.createPosOrder({
        showtimeId: selectedShowtime.showtimeId,
        seatShowtimeIds: selectedSeatIds,
        products: productsPayload.length > 0 ? productsPayload : undefined,
      });

      setPendingOrder(res);
      setRemainingSeconds(res.remainingSeconds || 600);
      setCashReceived(res.totalAmount || finalTotal);
      setSuccessBanner(
        "Đã giữ chỗ thành công trong 10 phút! Vui lòng thu tiền.",
      );

      // Refresh lại trạng thái ghế
      loadSeatsForShowtime(selectedShowtime.showtimeId);
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(err, "Không thể tạo đơn giữ chỗ tại quầy"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Áp dụng khuyến mãi / Voucher
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setActionLoading(true);
    setErrorBanner(null);
    try {
      if (pendingOrder) {
        const updated = await posApi.applyPromotion(
          pendingOrder.orderId,
          voucherCode.trim(),
        );
        setPendingOrder(updated);
        const discount = updated.promotion?.discountAmount || 0;
        setVoucherDiscount(discount);
        setVoucherApplied(voucherCode.trim());
        setCashReceived(updated.totalAmount);
        setSuccessBanner(
          `Áp dụng mã ${voucherCode.trim()} thành công! Giảm ${formatCurrency(discount)}`,
        );
      } else {
        setVoucherApplied(voucherCode.trim());
        setVoucherDiscount(30000);
        setSuccessBanner(`Đã ghi nhận mã voucher ${voucherCode.trim()}`);
      }
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(
          err,
          "Mã giảm giá không hợp lệ hoặc đã hết hạn",
        ),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Xác nhận hủy đơn tại quầy
  const handleConfirmCancelOrder = async () => {
    setIsCancelDialogOpen(false);
    if (!pendingOrder) {
      handleResetSession();
      return;
    }

    setActionLoading(true);
    try {
      await posApi.cancelPosOrder(
        pendingOrder.orderId,
        "Khách đổi ý hủy đơn tại quầy",
      );
      setSuccessBanner("Đã hủy đơn hàng và nhả ghế thành công.");
      handleResetSession();
    } catch (err) {
      setErrorBanner(getFriendlyErrorMessage(err, "Không thể hủy đơn hàng"));
    } finally {
      setActionLoading(false);
    }
  };

  // Thanh toán tiền mặt & In vé
  const handleCashPayment = async () => {
    if (!pendingOrder) {
      await handleCreateBookingOrder();
      return;
    }

    const currentTotal = pendingOrder.totalAmount || finalTotal;
    if (cashReceived < currentTotal) {
      setErrorBanner(
        `Số tiền khách đưa (${formatCurrency(cashReceived)}) không đủ tổng tiền (${formatCurrency(currentTotal)})`,
      );
      return;
    }

    setActionLoading(true);
    setErrorBanner(null);

    try {
      const payResult = await posApi.confirmCashPayment(pendingOrder.orderId, {
        cashReceived,
      });

      const receipt = await posApi.getReceipt(pendingOrder.orderId);
      setReceiptData(receipt);
      setIsReceiptModalOpen(true);
      setSuccessBanner(`Thanh toán thành công đơn #${payResult.orderCode}!`);
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(err, "Thanh toán tiền mặt thất bại"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Khởi tạo thanh toán QR
  const handleInitiateQr = async () => {
    if (!pendingOrder) {
      setErrorBanner(
        "Vui lòng bấm [Giữ chỗ & Tiếp tục] để tạo đơn trước khi sinh mã QR",
      );
      return;
    }

    setActionLoading(true);
    setErrorBanner(null);
    try {
      const qrRes = await posApi.initiateQrPayment(pendingOrder.orderId, {
        paymentMethod: qrProvider,
      });
      setQrPaymentData({
        qrCodeUrl:
          qrRes.qrCodeUrl ||
          `https://api.vietqr.io/image/970422-123456789-compact2.jpg?amount=${qrRes.amount}&addInfo=MYCAST_${pendingOrder.orderCode || pendingOrder.orderId.slice(-6)}`,
        transactionCode: qrRes.transactionCode,
      });
      setSuccessBanner(
        "Đã sinh mã QR thanh toán. Khách quét mã để thanh toán.",
      );
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(err, "Không thể tạo mã QR thanh toán"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Kiểm tra trạng thái thanh toán QR
  const handleCheckQrStatus = async () => {
    if (!pendingOrder) return;
    setIsQrChecking(true);
    try {
      const statusRes = await posApi.checkPaymentStatus(pendingOrder.orderId);
      if (statusRes.isPaid || statusRes.status === "PAID") {
        const receipt = await posApi.getReceipt(pendingOrder.orderId);
        setReceiptData(receipt);
        setIsReceiptModalOpen(true);
        setSuccessBanner("Thanh toán QR thành công! Mở hóa đơn in nhiệt.");
      } else {
        setErrorBanner(
          "Giao dịch chưa được thanh toán hoặc đang được ngân hàng xử lý.",
        );
      }
    } catch (err) {
      setErrorBanner(
        getFriendlyErrorMessage(
          err,
          "Không thể kiểm tra trạng thái thanh toán",
        ),
      );
    } finally {
      setIsQrChecking(false);
    }
  };

  const currentPayableAmount = pendingOrder
    ? pendingOrder.totalAmount
    : finalTotal;
  const changeDue = Math.max(0, cashReceived - currentPayableAmount);
  const isCashSufficient =
    cashReceived >= currentPayableAmount && currentPayableAmount > 0;

  const handleCashPaymentRef = useRef(handleCashPayment);
  useEffect(() => {
    handleCashPaymentRef.current = handleCashPayment;
  });

  // Phím tắt bàn phím tiện ích
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingOrder || selectedSeatIds.length > 0) {
          setIsCancelDialogOpen(true);
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        cashInputRef.current?.focus();
      } else if (e.key === "F10" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        if (paymentMethod === "CASH") {
          handleCashPaymentRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paymentMethod, isCashSufficient, pendingOrder, selectedSeatIds.length]);

  // Lọc danh sách suất chiếu hôm nay
  const filteredShowtimes = useMemo(() => {
    if (!showtimeSearch.trim()) return showtimes;
    const term = showtimeSearch.toLowerCase().trim();
    return showtimes.filter(
      (st) =>
        (st.movieTitle && st.movieTitle.toLowerCase().includes(term)) ||
        (st.roomName && st.roomName.toLowerCase().includes(term)) ||
        st.showtimeId.toLowerCase().includes(term),
    );
  }, [showtimes, showtimeSearch]);

  // Nhóm ghế theo hàng
  const seatRows = useMemo(() => {
    const rowMap = new Map<string, PosSeatShowtime[]>();
    for (const seat of seats) {
      const list = rowMap.get(seat.rowPosition) || [];
      list.push(seat);
      rowMap.set(seat.rowPosition, list);
    }
    const sortedRowKeys = Array.from(rowMap.keys()).sort();
    return sortedRowKeys.map((rowKey) => {
      const items = (rowMap.get(rowKey) || []).sort(
        (a, b) => a.columnPosition - b.columnPosition,
      );
      return { rowKey, items };
    });
  }, [seats]);

  return (
    <div className="space-y-4 font-['Arial',sans-serif]">
      {/* 1. Header Banner & Utility Bar */}
      <div className="border-b-2 border-[#231f20] pb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
              LOTTE CINEMA • ĐIỂM BÁN VÉ TẠI QUẦY (POS)
            </p>
            {staffUser?.branchId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-[#da291c] text-white">
                <MapPin className="h-3 w-3" />
                <span>{BRANCH_NAMES[staffUser.branchId] || staffUser.branchId}</span>
              </span>
            )}
          </div>
          <h1 className="mt-1 text-[22px] font-bold text-[#231f20] uppercase flex items-center gap-2.5">
            <MonitorPlay className="h-6 w-6 text-[#da291c]" />
            <span>Hệ thống bán vé & Bắp nước tại quầy</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-[#666]">
            {staffUser?.branchId ? (
              <>
                Chi nhánh trực thuộc:{" "}
                <strong className="text-[#231f20]">
                  {BRANCH_NAMES[staffUser.branchId] || staffUser.branchId}
                </strong>
                {" • "}
              </>
            ) : null}
            Chọn suất chiếu, đặt ghế phòng rạp, chọn combo F&B và in hóa đơn
            nhiệt cho khách hàng.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingOrder && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 border font-mono font-bold text-xs ${
                remainingSeconds <= 120
                  ? "bg-[#fef2f2] text-[#da291c] border-[#da291c] animate-pulse"
                  : "bg-[#fffbeb] text-[#b45309] border-[#f59e0b]"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>GIỮ CHỖ: {formatCountdown(remainingSeconds)}</span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 text-[12px] text-[#666] bg-white border border-[#dad2b4] px-3 py-1.5">
            <span>{currentDate}</span>
            <span className="text-[#da291c] font-bold font-mono">
              {currentTime}
            </span>
          </div>

          <Link
            href="/staff/orders"
            className="inline-flex h-[36px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-3 text-[12px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <History className="h-4 w-4" />
            <span>Lịch sử đơn</span>
          </Link>

          <button
            type="button"
            onClick={loadInitialData}
            className="inline-flex h-[36px] items-center gap-1.5 border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="h-4 w-4 text-[#6f6247]" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorBanner && (
        <div className="bg-[#fef2f2] border border-[#fca5a5] text-[#b91c1c] p-3 text-[13px] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-[12px] font-bold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] p-3 text-[13px] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-[12px] font-bold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2-Column POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (lg:col-span-8): TÁC VỤ BÁN VÉ */}
        <div className="lg:col-span-8 border border-[#dad2b4] bg-white shadow-sm flex flex-col">
          {/* Header Navigation Tabs */}
          <div className="bg-[#efebdb] border-b border-[#dad2b4] p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("showtimes")}
                className={`px-4 py-2 text-[12px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "showtimes"
                    ? "bg-[#da291c] text-white shadow-sm"
                    : "bg-white border border-[#dad2b4] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]"
                }`}
              >
                <CalendarClock className="h-4 w-4" />
                <span>1. Suất chiếu & Phim</span>
                {selectedShowtime && (
                  <span className="w-2 h-2 rounded-full bg-[#9bf73c]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedShowtime) {
                    setErrorBanner(
                      "Vui lòng chọn suất chiếu trước khi chọn ghế",
                    );
                    return;
                  }
                  setActiveTab("seats");
                }}
                className={`px-4 py-2 text-[12px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "seats"
                    ? "bg-[#da291c] text-white shadow-sm"
                    : "bg-white border border-[#dad2b4] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]"
                }`}
              >
                <Armchair className="h-4 w-4" />
                <span>2. Sơ đồ ghế</span>
                {selectedSeatIds.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#231f20] text-white text-[10px] font-extrabold rounded-full">
                    {selectedSeatIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("concessions")}
                className={`px-4 py-2 text-[12px] font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "concessions"
                    ? "bg-[#da291c] text-white shadow-sm"
                    : "bg-white border border-[#dad2b4] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]"
                }`}
              >
                <Popcorn className="h-4 w-4" />
                <span>3. Bắp nước & Combo</span>
                {productCart.size > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#d97706] text-white text-[10px] font-extrabold rounded-full">
                    {productCart.size}
                  </span>
                )}
              </button>
            </div>

            {selectedShowtime && (
              <div className="text-right">
                <p className="text-[12px] font-bold text-[#231f20] uppercase truncate max-w-[220px]">
                  {selectedShowtime.movieTitle || "Phim đã chọn"}
                </p>
                <p className="text-[11px] text-[#da291c] font-semibold">
                  Phòng: {selectedShowtime.roomName || "P01"} |{" "}
                  {new Date(selectedShowtime.startTime).toLocaleTimeString(
                    "vi-VN",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </p>
              </div>
            )}
          </div>

          {/* TAB 1: DANH SÁCH SUẤT CHIẾU HÔM NAY */}
          {activeTab === "showtimes" && (
            <div className="p-4 flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#888]" />
                  <input
                    type="text"
                    value={showtimeSearch}
                    onChange={(e) => setShowtimeSearch(e.target.value)}
                    placeholder="Tìm theo tên phim, phòng chiếu..."
                    className="w-full bg-[#fcfbfa] border border-[#dad2b4] pl-9 pr-8 py-2 text-[13px] text-[#231f20] placeholder-[#888] focus:outline-none focus:border-[#da291c]"
                  />
                  {showtimeSearch && (
                    <button
                      type="button"
                      onClick={() => setShowtimeSearch("")}
                      className="absolute right-2.5 top-2.5 text-[#888] hover:text-[#231f20]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <span className="text-[12px] text-[#666]">
                  Tổng cộng: <strong>{filteredShowtimes.length}</strong> suất
                  hôm nay
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {loading ? (
                  <div className="h-64 flex items-center justify-center text-[#888] text-[13px]">
                    Đang tải danh sách suất chiếu hôm nay...
                  </div>
                ) : filteredShowtimes.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-[#888] text-[13px]">
                    <p>
                      Không có suất chiếu nào hôm nay phù hợp tiêu chí tìm kiếm.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredShowtimes.map((st) => {
                      const isSelected =
                        selectedShowtime?.showtimeId === st.showtimeId;
                      const timeStr = new Date(st.startTime).toLocaleTimeString(
                        "vi-VN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      );
                      return (
                        <div
                          key={st.showtimeId}
                          onClick={() => handleSelectShowtime(st)}
                          className={`p-4 border transition-all cursor-pointer ${
                            isSelected
                              ? "border-2 border-[#da291c] bg-[#fff8f8] shadow-sm"
                              : "border-[#dad2b4] bg-[#fcfbfa] hover:bg-white hover:border-[#c1b687]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-[14px] text-[#231f20] uppercase leading-snug">
                                {st.movieTitle || "PHIM CHIẾU RẠP"}
                              </h4>
                              <p className="text-[12px] text-[#666] mt-0.5">
                                Phòng:{" "}
                                <strong className="text-[#231f20]">
                                  {st.roomName || "Phòng 01"}
                                </strong>
                              </p>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 bg-[#efebdb] text-[#6f6247] border border-[#dad2b4]">
                              {st.format || "2D"}
                            </span>
                          </div>

                          <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-[#efebdb]">
                            <div className="flex items-center gap-2">
                              <span className="text-[16px] font-black text-[#da291c] font-mono">
                                {timeStr}
                              </span>
                              <span className="text-[11px] text-[#888]">
                                (
                                {new Date(st.startTime).toLocaleDateString(
                                  "vi-VN",
                                )}
                                )
                              </span>
                            </div>
                            <span className="text-[13px] font-bold text-[#15803d]">
                              {formatCurrency(st.basePrice || 75000)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SƠ ĐỒ GHẾ THỜI GIAN THỰC */}
          {activeTab === "seats" && (
            <div className="p-4 flex flex-col min-h-[500px]">
              {/* Header Màn hình cong Lotte Cinema */}
              <div className="w-full flex flex-col items-center mb-6 shrink-0">
                <div className="w-4/5 h-2 bg-gradient-to-r from-[#e3e1d6] via-[#da291c] to-[#e3e1d6] shadow-[0_-2px_10px_rgba(218,41,28,0.3)]" />
                <p className="text-[11px] font-bold tracking-[0.2em] text-[#6f6247] uppercase mt-1.5">
                  MÀN HÌNH CHIẾU • SCREEN
                </p>
              </div>

              {/* Grid Ghế */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-2">
                <div className="space-y-2">
                  {seatRows.map(({ rowKey, items }) => (
                    <div
                      key={rowKey}
                      className="flex items-center gap-1.5 justify-center"
                    >
                      <span className="w-5 text-center font-bold text-[12px] text-[#6f6247] font-mono">
                        {rowKey}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {items.map((seat) => {
                          const isSelected = selectedSeatIds.includes(
                            seat.seatShowtimeId,
                          );
                          const isBooked = seat.seatStatus === "BOOKED";
                          const isReserved = seat.seatStatus === "RESERVED";
                          const type = (seat.seatType || "").toUpperCase();
                          const isVip = type.includes("VIP");
                          const isCouple =
                            type.includes("COUPLE") || type.includes("ĐÔI");

                          let btnClasses =
                            "w-8 h-8 text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ";

                          if (isSelected) {
                            btnClasses +=
                              "bg-[#da291c] text-white border-2 border-[#b91c1c] shadow-md ring-2 ring-[#da291c]/30 scale-105";
                          } else if (isBooked) {
                            btnClasses +=
                              "bg-[#e5e5e5] text-[#999] border border-[#ccc] cursor-not-allowed";
                          } else if (isReserved) {
                            btnClasses +=
                              "bg-[#fed7aa] text-[#c2410c] border border-[#f97316] cursor-not-allowed";
                          } else {
                            if (isCouple) {
                              btnClasses +=
                                "w-16 bg-[#fce7f3] text-[#9d174d] border border-[#f472b6] hover:bg-[#fbcfe8]";
                            } else if (isVip) {
                              btnClasses +=
                                "bg-[#fef3c7] text-[#92400e] border border-[#f59e0b] hover:bg-[#fde68a]";
                            } else {
                              btnClasses +=
                                "bg-white text-[#231f20] border border-[#dad2b4] hover:border-[#da291c] hover:bg-[#efebdb]";
                            }
                          }

                          return (
                            <button
                              key={seat.seatShowtimeId}
                              disabled={isBooked || isReserved}
                              onClick={() => toggleSeat(seat)}
                              className={btnClasses}
                              title={`Ghế ${rowKey}${seat.columnPosition} - ${seat.seatType}`}
                            >
                              {seat.columnPosition}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-5 text-center font-bold text-[12px] text-[#6f6247] font-mono">
                        {rowKey}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chú giải trạng thái ghế */}
              <div className="pt-3 border-t border-[#dad2b4] bg-[#efebdb] p-2.5 flex items-center justify-center gap-4 text-[12px] text-[#6f6247] shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-white border border-[#dad2b4]" />
                  <span>Thường</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#fef3c7] border border-[#f59e0b]" />
                  <span>VIP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-3.5 bg-[#fce7f3] border border-[#f472b6]" />
                  <span>Ghế đôi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#da291c] border border-[#b91c1c]" />
                  <span className="font-bold text-[#da291c]">Đang chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#fed7aa] border border-[#f97316]" />
                  <span className="text-[#c2410c]">Đang giữ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#e5e5e5] border border-[#ccc]" />
                  <span className="text-[#999]">Đã bán</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DANH MỤC BẮP NƯỚC & COMBO */}
          {activeTab === "concessions" && (
            <div className="p-4 flex flex-col min-h-[500px] overflow-y-auto space-y-6">
              {/* Combos */}
              {catalog?.combos && catalog.combos.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold text-[#b45309] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d97706]" />
                    Gói Combo Ưu Đãi Lotte Cinema
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {catalog.combos.map((combo) => {
                      const inCart = productCart.get(combo.comboId);
                      const qty = inCart ? inCart.quantity : 0;
                      const isOutOfStock = combo.availableStock <= 0;

                      return (
                        <div
                          key={combo.comboId}
                          className={`p-3.5 border transition-all ${
                            qty > 0
                              ? "border-2 border-[#da291c] bg-[#fff8f8] shadow-sm"
                              : "border-[#dad2b4] bg-[#fcfbfa] hover:bg-white hover:border-[#c1b687]"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-[13px] text-[#231f20] uppercase">
                                {combo.name}
                              </h5>
                              <p className="text-[11px] text-[#666] mt-0.5">
                                {combo.items
                                  .map((i) => `${i.name} x${i.quantity}`)
                                  .join(" + ")}
                              </p>
                            </div>
                            <span className="text-[13px] font-bold text-[#da291c]">
                              {formatCurrency(combo.price)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#efebdb]">
                            <span className="text-[11px] text-[#666]">
                              Tồn kho:{" "}
                              <strong
                                className={
                                  combo.availableStock <= 5
                                    ? "text-[#da291c]"
                                    : "text-[#231f20]"
                                }
                              >
                                {combo.availableStock}
                              </strong>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={qty <= 0}
                                onClick={() =>
                                  updateProductQuantity(
                                    {
                                      id: combo.comboId,
                                      name: combo.name,
                                      price: combo.price,
                                      maxStock: combo.availableStock,
                                      isCombo: true,
                                    },
                                    -1,
                                  )
                                }
                                className="w-7 h-7 bg-[#efebdb] border border-[#dad2b4] text-[#231f20] hover:bg-[#dad2b4] disabled:opacity-40 text-sm font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-bold text-xs w-6 text-center font-mono">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  isOutOfStock || qty >= combo.availableStock
                                }
                                onClick={() =>
                                  updateProductQuantity(
                                    {
                                      id: combo.comboId,
                                      name: combo.name,
                                      price: combo.price,
                                      maxStock: combo.availableStock,
                                      isCombo: true,
                                    },
                                    1,
                                  )
                                }
                                className="w-7 h-7 bg-[#da291c] hover:bg-[#b91c1c] disabled:opacity-40 text-sm font-bold flex items-center justify-center text-white cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Món lẻ Items */}
              {catalog?.items && catalog.items.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold text-[#231f20] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6f6247]" />
                    Bắp rang bơ & Nước ngọt lẻ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {catalog.items.map((item) => {
                      const inCart = productCart.get(item.itemId);
                      const qty = inCart ? inCart.quantity : 0;
                      const isOutOfStock = item.stockQuantity <= 0;

                      return (
                        <div
                          key={item.itemId}
                          className={`p-3.5 border transition-all ${
                            qty > 0
                              ? "border-2 border-[#da291c] bg-[#fff8f8] shadow-sm"
                              : "border-[#dad2b4] bg-[#fcfbfa] hover:bg-white hover:border-[#c1b687]"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-[13px] text-[#231f20]">
                                {item.name}
                              </h5>
                              <p className="text-[11px] text-[#666] mt-0.5">
                                {item.size
                                  ? `Size: ${item.size}`
                                  : item.category}
                              </p>
                            </div>
                            <span className="text-[13px] font-bold text-[#15803d]">
                              {formatCurrency(item.price)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#efebdb]">
                            <span className="text-[11px] text-[#666]">
                              Kho:{" "}
                              <strong
                                className={
                                  item.stockQuantity <= 5
                                    ? "text-[#da291c]"
                                    : "text-[#231f20]"
                                }
                              >
                                {item.stockQuantity}
                              </strong>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={qty <= 0}
                                onClick={() =>
                                  updateProductQuantity(
                                    {
                                      id: item.itemId,
                                      name: item.name,
                                      price: item.price,
                                      maxStock: item.stockQuantity,
                                      isCombo: false,
                                    },
                                    -1,
                                  )
                                }
                                className="w-7 h-7 bg-[#efebdb] border border-[#dad2b4] text-[#231f20] hover:bg-[#dad2b4] disabled:opacity-40 text-sm font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-bold text-xs w-6 text-center font-mono">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  isOutOfStock || qty >= item.stockQuantity
                                }
                                onClick={() =>
                                  updateProductQuantity(
                                    {
                                      id: item.itemId,
                                      name: item.name,
                                      price: item.price,
                                      maxStock: item.stockQuantity,
                                      isCombo: false,
                                    },
                                    1,
                                  )
                                }
                                className="w-7 h-7 bg-[#da291c] hover:bg-[#b91c1c] disabled:opacity-40 text-sm font-bold flex items-center justify-center text-white cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (lg:col-span-4): GIỎ HÀNG & THANH TOÁN */}
        <div className="lg:col-span-4 border border-[#dad2b4] bg-white shadow-sm flex flex-col">
          {/* Header Giỏ hàng */}
          <div className="p-3.5 bg-[#efebdb] border-b border-[#dad2b4] flex items-center justify-between shrink-0">
            <h3 className="font-bold text-[13px] text-[#231f20] uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[#da291c]" />
              <span>CHI TIẾT ĐƠN HÀNG</span>
            </h3>
            {pendingOrder && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#fff8f8] text-[#da291c] border border-[#da291c]">
                PENDING #
                {pendingOrder.orderCode || pendingOrder.orderId.slice(-6)}
              </span>
            )}
          </div>

          {/* Danh sách mục đã chọn */}
          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[380px]">
            {/* Mục Vé xem phim */}
            <div className="bg-[#fcfbfa] p-3 border border-[#dad2b4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#6f6247] uppercase flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-[#da291c]" />
                  Vé xem phim ({selectedSeatObjects.length})
                </span>
                <span className="text-xs font-bold text-[#231f20] font-mono">
                  {formatCurrency(totalSeatsPrice)}
                </span>
              </div>

              {selectedSeatObjects.length === 0 ? (
                <p className="text-xs text-[#888] italic">Chưa chọn ghế nào</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSeatObjects.map((s) => (
                    <span
                      key={s.seatShowtimeId}
                      className="px-2 py-0.5 bg-[#efebdb] text-[#da291c] border border-[#dad2b4] text-[11px] font-bold font-mono"
                    >
                      {s.rowPosition}
                      {s.columnPosition} ({s.seatType})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Mục Bắp nước */}
            <div className="bg-[#fcfbfa] p-3 border border-[#dad2b4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#6f6247] uppercase flex items-center gap-1.5">
                  <Popcorn className="h-3.5 w-3.5 text-[#d97706]" />
                  Bắp nước & Combo ({productCart.size})
                </span>
                <span className="text-xs font-bold text-[#231f20] font-mono">
                  {formatCurrency(totalProductsPrice)}
                </span>
              </div>

              {productCart.size === 0 ? (
                <p className="text-xs text-[#888] italic">Chưa chọn bắp nước</p>
              ) : (
                <div className="space-y-1.5">
                  {Array.from(productCart.values()).map((p) => (
                    <div
                      key={p.productId}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="text-[#555] truncate max-w-[170px]">
                        {p.name}{" "}
                        <strong className="text-[#231f20]">
                          x{p.quantity}
                        </strong>
                      </span>
                      <span className="font-mono text-[#231f20] font-semibold">
                        {formatCurrency(p.unitPrice * p.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Khuyến mãi / Voucher */}
            <div className="bg-[#fcfbfa] p-3 border border-[#dad2b4]">
              <label className="block text-[11px] font-bold text-[#6f6247] mb-1.5 uppercase">
                MÃ GIẢM GIÁ (VOUCHER)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="VD: LOTTE10, GIAM20"
                  className="flex-1 bg-white border border-[#dad2b4] px-2.5 py-1.5 text-xs text-[#231f20] uppercase placeholder-[#888] focus:outline-none focus:border-[#da291c] font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  disabled={actionLoading || !voucherCode.trim()}
                  className="px-3 py-1.5 bg-[#efebdb] border border-[#dad2b4] hover:bg-[#dad2b4] disabled:opacity-40 text-xs font-bold text-[#6f6247] hover:text-[#231f20] cursor-pointer transition-colors"
                >
                  Áp dụng
                </button>
              </div>
              {voucherApplied && (
                <div className="mt-1.5 text-[11px] text-[#15803d] font-semibold flex items-center justify-between">
                  <span>Mã áp dụng: {voucherApplied}</span>
                  <span>-{formatCurrency(voucherDiscount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tóm tắt số tiền */}
          <div className="p-3.5 bg-[#efebdb] border-t border-[#dad2b4] space-y-1.5 shrink-0 text-xs">
            <div className="flex justify-between text-[#666]">
              <span>Tạm tính:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {voucherDiscount > 0 && (
              <div className="flex justify-between text-[#15803d]">
                <span>Giảm giá:</span>
                <span className="font-mono">
                  -{formatCurrency(voucherDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-[#dad2b4] text-sm">
              <span className="font-bold text-[#231f20] uppercase">
                TỔNG CỘNG:
              </span>
              <span className="text-xl font-black text-[#da291c] font-mono">
                {formatCurrency(currentPayableAmount)}
              </span>
            </div>
          </div>

          {/* Phương thức Thanh toán */}
          <div className="p-3.5 bg-white border-t border-[#dad2b4] shrink-0 space-y-3">
            {/* Nút chọn kênh */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === "CASH"
                    ? "bg-[#15803d] text-white shadow-sm"
                    : "bg-[#efebdb] border border-[#dad2b4] text-[#6f6247] hover:bg-[#dad2b4]"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>TIỀN MẶT</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("QR");
                  if (pendingOrder && !qrPaymentData) {
                    handleInitiateQr();
                  }
                }}
                className={`py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === "QR"
                    ? "bg-[#1d4ed8] text-white shadow-sm"
                    : "bg-[#efebdb] border border-[#dad2b4] text-[#6f6247] hover:bg-[#dad2b4]"
                }`}
              >
                <QrCode className="h-4 w-4" />
                <span>CHUYỂN KHOẢN QR</span>
              </button>
            </div>

            {/* Chi tiết Thanh toán Tiền mặt */}
            {paymentMethod === "CASH" && (
              <div className="space-y-2 bg-[#fcfbfa] p-3 border border-[#dad2b4]">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-[#6f6247] font-semibold whitespace-nowrap">
                    Tiền khách đưa (F9):
                  </label>
                  <input
                    ref={cashInputRef}
                    type="number"
                    value={cashReceived || ""}
                    onChange={(e) =>
                      setCashReceived(Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-36 text-right bg-white border border-[#dad2b4] px-2.5 py-1 text-sm font-bold font-mono text-[#15803d] focus:outline-none focus:border-[#15803d]"
                  />
                </div>

                {/* Các nút gợi ý tiền nhanh */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setCashReceived(currentPayableAmount)}
                    className="flex-1 py-1 bg-[#efebdb] border border-[#dad2b4] hover:bg-[#dad2b4] text-[10px] font-bold text-[#6f6247] hover:text-[#231f20] transition-colors"
                  >
                    Vừa đủ
                  </button>
                  {[100000, 200000, 300000, 500000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCashReceived(val)}
                      className="px-2 py-1 bg-[#efebdb] border border-[#dad2b4] hover:bg-[#dad2b4] text-[10px] font-bold text-[#6f6247] hover:text-[#231f20] transition-colors"
                    >
                      {val / 1000}k
                    </button>
                  ))}
                </div>

                {/* Tiền thừa */}
                <div className="flex justify-between items-center pt-2 border-t border-[#dad2b4] text-xs">
                  <span className="text-[#666]">Tiền thừa trả khách:</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      isCashSufficient ? "text-[#15803d]" : "text-[#da291c]"
                    }`}
                  >
                    {isCashSufficient
                      ? formatCurrency(changeDue)
                      : "Chưa đủ tiền"}
                  </span>
                </div>
              </div>
            )}

            {/* Chi tiết Thanh toán QR */}
            {paymentMethod === "QR" && (
              <div className="space-y-2.5 bg-[#fcfbfa] p-3 border border-[#dad2b4]">
                <div className="flex gap-2">
                  {(["VNPAY"] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        setQrProvider(prov);
                        if (pendingOrder) handleInitiateQr();
                      }}
                      className={`flex-1 py-1 text-[11px] font-bold transition-colors ${
                        qrProvider === prov
                          ? "bg-[#1d4ed8] text-white shadow-xs"
                          : "bg-[#efebdb] border border-[#dad2b4] text-[#6f6247]"
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>

                {qrPaymentData ? (
                  <div className="flex flex-col items-center p-3 bg-white border border-[#dad2b4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrPaymentData.qrCodeUrl}
                      alt="VietQR"
                      className="w-32 h-32 object-contain"
                    />
                    <p className="text-[10px] text-[#231f20] font-mono font-bold mt-1">
                      Mã GD: {qrPaymentData.transactionCode}
                    </p>
                    <button
                      type="button"
                      onClick={handleCheckQrStatus}
                      disabled={isQrChecking}
                      className="mt-2 w-full py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      {isQrChecking
                        ? "Đang kiểm tra..."
                        : "Kiểm tra trạng thái thanh toán"}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-[#888] py-4">
                    Bấm &quot;Tạo đơn giữ chỗ&quot; để sinh mã QR thanh toán
                  </p>
                )}
              </div>
            )}

            {/* Hàng nút hành động chính */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Nút Hủy Đơn */}
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={
                  actionLoading ||
                  (!pendingOrder && selectedSeatIds.length === 0)
                }
                className="py-3 bg-[#efebdb] border border-[#dad2b4] text-[#6f6247] hover:bg-[#fee2e2] hover:text-[#da291c] hover:border-[#fca5a5] disabled:opacity-40 text-xs font-bold transition-colors cursor-pointer"
                title="Hủy đơn (Esc)"
              >
                HỦY (Esc)
              </button>

              {/* Nút hành động chính */}
              {!pendingOrder ? (
                <button
                  type="button"
                  onClick={handleCreateBookingOrder}
                  disabled={actionLoading || selectedSeatIds.length === 0}
                  className="col-span-2 py-3 bg-[#d97706] hover:bg-[#b45309] disabled:opacity-40 text-white text-xs font-black shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  GIỮ CHỖ & TIẾP TỤC
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    paymentMethod === "CASH"
                      ? handleCashPayment
                      : handleCheckQrStatus
                  }
                  disabled={
                    actionLoading ||
                    (paymentMethod === "CASH" && !isCashSufficient)
                  }
                  className="col-span-2 py-3 bg-[#da291c] hover:bg-[#b91c1c] disabled:opacity-40 text-white text-xs font-black shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  THU TIỀN & IN VÉ (F10)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal In Hóa Đơn Nhiệt 80mm */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        receipt={receiptData}
        onClose={() => setIsReceiptModalOpen(false)}
        onNewOrder={handleResetSession}
      />

      {/* Dialog Xác nhận Hủy Đơn Quầy */}
      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-[#dad2b4] p-5 shadow-2xl text-[#231f20]">
            <div className="w-10 h-10 bg-[#fee2e2] text-[#da291c] flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-base text-[#231f20]">
              Xác nhận hủy phiên bán vé?
            </h4>
            <p className="text-xs text-[#666] mt-1.5 leading-relaxed">
              Toàn bộ ghế đang chọn hoặc đang giữ chỗ cho khách sẽ được giải
              phóng ngay lập tức trên hệ thống rạp.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
                className="px-4 py-2 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] text-xs font-bold transition-colors cursor-pointer"
              >
                Tiếp tục giữ
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#da291c] hover:bg-[#b91c1c] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đồng ý hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
