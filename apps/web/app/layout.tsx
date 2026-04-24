import type { Metadata } from "next";
import Link from "next/link";
import { siteMeta } from "@devtoollab/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: `${siteMeta.name} | AI 内容与工具站`,
  description: siteMeta.description
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <main>
          <header className="topbar">
            <Link href="/" className="brand">
              {siteMeta.name}
            </Link>
            <nav className="nav">
              <Link href="/news">文章</Link>
              <Link href="/tools">工具</Link>
              <a href="http://localhost:5174" target="_blank" rel="noreferrer">
                后台
              </a>
              <a href="http://localhost:8787/health" target="_blank" rel="noreferrer">
                API
              </a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
