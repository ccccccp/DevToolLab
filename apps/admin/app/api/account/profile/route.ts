import { NextRequest, NextResponse } from "next/server";
import { updateAdminUserDisplayName } from "@devtoollab/shared/api-client";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, parseAdminSessionToken } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  const session = await parseAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ ok: false, error: "账号已禁用" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as { displayName?: string } | null;
  const displayName = payload?.displayName?.trim();
  if (!displayName) {
    return NextResponse.json({ ok: false, error: "用户名不能为空" }, { status: 400 });
  }

  const user = await updateAdminUserDisplayName(session.userId, displayName);
  if (!user) {
    return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    await createAdminSessionToken({
      ...session,
      displayName: user.displayName
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    }
  );

  return response;
}
