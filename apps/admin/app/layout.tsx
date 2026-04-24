import type { Metadata } from "next";
import Link from "next/link";
import { adminSections, siteMeta } from "@devtoollab/shared";
import { ToastContainer } from "./toast-container";
import "./globals.css";

export const metadata: Metadata = {
  title: `${siteMeta.name} Admin`,
  description: "DevToolLab 的后台运营系统。"
};

function getAdminApiBaseUrl() {
  const configured = process.env.DEVTOOLLAB_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development" ? "http://127.0.0.1:8787" : "";
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiBaseUrl = getAdminApiBaseUrl();

  return (
    <html lang="zh-CN">
      <body>
        {apiBaseUrl ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__DEVTOOLLAB_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`
            }}
          />
        ) : null}
        <main>
          <header className="header">
            <Link href="/" className="brand">
              {siteMeta.name} Admin
            </Link>
            <nav className="menu">
              {adminSections.map((section) => (
                <Link key={section.slug} href={section.href}>
                  {section.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
