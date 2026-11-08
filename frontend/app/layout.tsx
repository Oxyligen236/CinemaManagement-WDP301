import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { R2_PUBLIC_URL } from "@/lib/constants/r2";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Latte Cinema - Hệ thống rạp chiếu phim Latte Cinema",
  description: "Đặt vé xem phim trực tuyến tại Latte Cinema Vietnam",
  icons: {
    icon: `${R2_PUBLIC_URL}/sites/lottecinemavn/ui/logo_bar.png`,
    shortcut: `${R2_PUBLIC_URL}/sites/lottecinemavn/ui/logo_bar.png`,
    apple: `${R2_PUBLIC_URL}/sites/lottecinemavn/ui/logo_bar.png`,
  },
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
