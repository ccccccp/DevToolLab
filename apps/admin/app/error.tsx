"use client";

import { useEffect } from "react";
import { toast } from "@devtoollab/shared";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产环境下虽然 message 模糊，但 digest 是追踪日志的关键
    console.error("Admin Render Error:", error);
  }, [error]);

  return (
    <div className="admin-section">
      <div className="card error-card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2 style={{ color: "#b42318", marginBottom: "16px" }}>页面渲染崩溃</h2>
        <p className="muted">渲染过程中发生了非预期错误。</p>
        
        {error.digest && (
          <div style={{ marginTop: "20px", fontSize: "12px", opacity: 0.6 }}>
            Error Digest: <code>{error.digest}</code>
          </div>
        )}

        <div className="actions-row" style={{ justifyContent: "center", marginTop: "32px" }}>
          <button className="button primary-button" onClick={() => reset()}>
            尝试重试
          </button>
          <a href="/" className="button">
            回到首页
          </a>
        </div>
      </div>
    </div>
  );
}
