"use client";

import { useEffect, useRef } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  disabled?: boolean;
}

export function QrScanner({ onScanSuccess, disabled }: QrScannerProps) {
  const containerId = "mycast-qr-reader";
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const callbackRef = useRef(onScanSuccess);

  useEffect(() => {
    callbackRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    if (disabled) return;
    let mounted = true;
    let scanner: Html5QrcodeScanner | null = null;

    void import("html5-qrcode").then(({ Html5QrcodeScanner: Scanner }) => {
      if (!mounted) return;
      scanner = new Scanner(containerId, { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scannerRef.current = scanner;
      scanner.render((text) => text.trim() && callbackRef.current(text.trim()), () => {});
    }).catch((error: unknown) => console.error("Khởi tạo camera quét mã thất bại:", error));

    return () => {
      mounted = false;
      const active = scanner ?? scannerRef.current;
      scannerRef.current = null;
      if (active) void active.clear().catch((error: unknown) => console.warn("Lỗi dọn dẹp scanner:", error));
    };
  }, [disabled]);

  return (
    <div className="overflow-hidden rounded-xl border border-border-main bg-surface p-4 shadow-card">
      <div className="mb-2 text-sm font-semibold text-text-main">Camera quét mã QR</div>
      <div id={containerId} className="w-full min-h-[280px] overflow-hidden rounded-lg bg-surface-muted" />
      <p className="mt-2 text-xs text-text-muted">Đưa mã QR trên vé vào ô vuông trung tâm. Đảm bảo ánh sáng đủ rõ.</p>
    </div>
  );
}
