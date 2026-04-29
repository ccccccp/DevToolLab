"use server";

import { redirect } from "next/navigation";
import {
  createAdminUser,
  updateAdminUserPassword,
  updateAdminUserStatus
} from "@devtoollab/shared/api-client";
import { getCurrentAdminSession } from "../../lib/server-session";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(message: string) {
  redirect(`/users?error=${encodeURIComponent(message)}`);
}

async function requireAdminSession() {
  const session = await getCurrentAdminSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/account?error=权限不足");
  }

  return session;
}

export async function createUserAction(formData: FormData) {
  await requireAdminSession();

  try {
    await createAdminUser({
      email: text(formData, "email"),
      displayName: text(formData, "displayName"),
      password: text(formData, "password"),
      role: (text(formData, "role") as "admin" | "editor") || "editor",
      status: (text(formData, "status") as "active" | "disabled") || "active"
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "无法创建用户");
  }

  redirect("/users");
}

export async function updateUserStatusAction(formData: FormData) {
  await requireAdminSession();

  try {
    await updateAdminUserStatus(text(formData, "id"), text(formData, "status") as "active" | "disabled");
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "无法更新状态");
  }

  redirect("/users");
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdminSession();

  try {
    await updateAdminUserPassword(text(formData, "id"), text(formData, "password"));
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "无法重置密码");
  }

  redirect("/users");
}
