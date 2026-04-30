export function getEnv() {
  return process.env as Record<string, string | undefined>;
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