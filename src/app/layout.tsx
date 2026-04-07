import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "루딤웹 - 임대형 사이트 플랫폼",
  description: "루딤웹으로 전문적인 홈페이지를 손쉽게 운영하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
