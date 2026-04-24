"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TasksNav() {
  const pathname = usePathname();

  const navs = [
    { label: "任务看板", href: "/tasks" },
    { label: "抓取历史", href: "/tasks/items" },
    { label: "审核队列", href: "/tasks/reviews" },
    { label: "执行日志", href: "/tasks/logs" }
  ];

  return (
    <nav className="tab-nav">
      {navs.map((nav) => {
        const isActive = pathname === nav.href;
        return (
          <Link
            key={nav.href}
            href={nav.href}
            className={`tab-link ${isActive ? "active" : ""}`}
          >
            {nav.label}
          </Link>
        );
      })}
    </nav>
  );
}
