"use server";

import { redirect } from "next/navigation";
import { bootstrapAdminUser } from "@devtoollab/shared/api-client";
import { setCurrentAdminSession } from "../../lib/server-session";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function registerAction(formData: FormData) {
  try {
    const result = await bootstrapAdminUser({
      email: text(formData, "email"),
      password: text(formData, "password"),
      displayName: text(formData, "displayName"),
      role: "admin",
      status: "active"
    });

    await setCurrentAdminSession({
      userId: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
      status: result.user.status,
      issuedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法注册";
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }

  redirect("/");
}
