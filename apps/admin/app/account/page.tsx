import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "../../lib/server-session";
import { AccountClient } from "./account-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCurrentAdminSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">个人账户</span>
          <h1>我的账户</h1>
          <p className="muted">当前账号只允许修改自己的用户名和密码。角色为 {session.role}。</p>
        </div>
      </div>
      <AccountClient session={session} />
    </section>
  );
}
