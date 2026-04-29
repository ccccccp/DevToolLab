"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { loginAdminUser } from "@devtoollab/shared/api-client";
import { setCurrentAdminSession } from "../../lib/server-session";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function loginAction(formData: FormData) {
  const nextPath = text(formData, "next") || "/";
  try {
    const result = await loginAdminUser({
      email: text(formData, "email"),
      password: text(formData, "password")
    });

    await setCurrentAdminSession({
      userId: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
      status: result.user.status,
      issuedAt: new Date().toISOString()
    });

    const target = result.user.role === "admin" ? (nextPath === "/" ? "/" : nextPath) : "/account";
    redirect(target);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "无法登录";
    redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(nextPath)}`);
  }
}
