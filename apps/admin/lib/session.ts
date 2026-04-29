import type { AdminUserRecord } from "@devtoollab/shared";

export const ADMIN_SESSION_COOKIE = "devtoollab_admin_session";

export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminUserRecord["role"];
  status: AdminUserRecord["status"];
  issuedAt: string;
};

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

function textEncoder(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importSessionKey(secret = getSessionSecret()) {
  return crypto.subtle.importKey("raw", textEncoder(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

async function sign(value: string, secret = getSessionSecret()) {
  const key = await importSessionKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createAdminSessionToken(session: AdminSession) {
  const payload = bytesToBase64Url(textEncoder(JSON.stringify(session)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function parseAdminSessionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const key = await importSessionKey();
  const verified = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), textEncoder(payload));
  if (!verified) {
    return null;
  }

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AdminSession;
  } catch {
    return null;
  }
}
