"use server";

import { redirect } from "next/navigation";
import { clearCurrentAdminSession } from "../../lib/server-session";

export async function logoutAction() {
  await clearCurrentAdminSession();
  redirect("/login");
}
