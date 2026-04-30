import type { Metadata } from "next";
import Link from "next/link";
import { adminSections, siteMeta } from "@devtoollab/shared";
import { ToastContainer } from "./toast-container";
import { TopProgressBar } from "./top-progress-bar";
import { logoutAction } from "./logout/actions";
import { getCurrentAdminSession } from "../lib/server-session";
import { getAdminApiBaseUrl } from '../lib/envHelper';
import "./globals.css";


export const metadata: Metadata = {
  title: `${siteMeta.name} Admin`,
  description: "DevToolLab 的后台运营系统。"
};



export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiBaseUrl = getAdminApiBaseUrl();
  const session = await getCurrentAdminSession();
  return (
    <html lang="zh-CN">
      <body>
        {apiBaseUrl ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__DEVTOOLLAB_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`
            }}
          />
        ) : <div>未配置 API 基础 URL</div>}
        <TopProgressBar />
        <main>
          <header className="header">
            <Link href="/" className="brand">
              {siteMeta.name} Admin
            </Link>
            {session ? (
              <div className="header-actions">
                <nav className="menu">
                  <Link href="/account">个人账户</Link>
                  {session.role === "admin" ? <Link href="/users">用户管理</Link> : null}
                  {adminSections.map((section) => (
                    <Link key={section.slug} href={section.href}>
                      {section.label}
                    </Link>
                  ))}
                </nav>
                <div className="session-chip">
                  <span>
                    {session.displayName}
                    <small>{session.role}</small>
                  </span>
                  <form action={logoutAction}>
                    <button type="submit" className="button">
                      退出
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <nav className="menu">
                <Link href="/login">登录</Link>
                <Link href="/register">注册</Link>
              </nav>
            )}
          </header>
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
