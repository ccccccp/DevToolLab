import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getEnv() {
  try {
    // 先尝试 Cloudflare 环境
    const context = getCloudflareContext();
    return context.env;
  } catch (error) {
    // 非 Cloudflare 环境（本地 next dev、Vercel、Node.js 服务器等）
    // 回退到 process.env
    return process.env as Record<string, string | undefined>;
  }
}

export function getAdminApiBaseUrl() {
    const env = getEnv()
    const configured = env?.DEVTOOLLAB_API_BASE_URL?.trim();
    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    return process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:8787"
        : "";
}