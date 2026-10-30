import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Latte Cinema - Hệ thống rạp chiếu phim Latte Cinema",
  description: "Đặt vé xem phim trực tuyến tại Latte Cinema Vietnam",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className={`${inter.className} min-h-full flex flex-col font-sans`}>{children}</body>
    </html>
  );
}
