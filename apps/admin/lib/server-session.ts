import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, parseAdminSessionToken, type AdminSession } from "./session";
import { resolveActiveAdminSession } from "./admin-session";

export async function getCurrentAdminSession() {
  const cookieStore = await cookies();
  const session = await parseAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  return resolveActiveAdminSession(session);
}

export async function setCurrentAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export async function clearCurrentAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
