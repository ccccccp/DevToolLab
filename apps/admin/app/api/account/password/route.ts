import { NextRequest, NextResponse } from "next/server";
import { updateAdminUserPassword } from "@devtoollab/shared/api-client";
import { ADMIN_SESSION_COOKIE, parseAdminSessionToken } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  const session = await parseAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ ok: false, error: "账号已禁用" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = payload?.password?.trim();
  if (!password) {
    return NextResponse.json({ ok: false, error: "密码不能为空" }, { status: 400 });
  }

  const user = await updateAdminUserPassword(session.userId, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}
