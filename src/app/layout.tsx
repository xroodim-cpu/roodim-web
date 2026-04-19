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
    <html lang="ko" className="h-full antialiased" data-theme="light">
      <head>
        {/* 루딤링크와 동일한 폰트 스택 — Pretendard + Material Symbols Rounded */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
