import Link from "next/link";
import { redirect } from "next/navigation";
import { listAdminUsers } from "@devtoollab/shared/api-client";
import { getCurrentAdminSession } from "../../lib/server-session";
import { registerAction } from "./actions";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getCurrentAdminSession();
  if (session) {
    redirect("/");
  }

  const { error } = await searchParams;
  const users = await listAdminUsers();

  if (users.length > 0) {
    return (
      <section className="auth-shell">
        <article className="card auth-card">
          <span className="eyebrow">Admin Setup</span>
          <h1>后台账号已经初始化</h1>
          <p className="muted">当前系统中已经存在管理员账号，请直接使用登录页进入后台。</p>
          <div className="actions-row">
            <Link href="/login" className="button primary-button">
              去登录
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <article className="card auth-card">
        <span className="eyebrow">First Admin</span>
        <h1>创建首个后台账号</h1>
        <p className="muted">首次使用时先创建一个管理员账号，之后可在用户管理页继续添加成员。</p>

        {error ? <p className="auth-alert">{error}</p> : null}

        <form action={registerAction} className="editor-form auth-form">
          <label className="field">
            <span>显示名称</span>
            <input type="text" name="displayName" required placeholder="后台管理员" />
          </label>
          <label className="field">
            <span>邮箱</span>
            <input type="email" name="email" required placeholder="admin@devtoollab.com" />
          </label>
          <label className="field">
            <span>密码</span>
            <input type="password" name="password" required placeholder="至少 8 位" minLength={8} />
          </label>
          <div className="actions-row">
            <button type="submit" className="button primary-button">
              创建账号
            </button>
            <Link href="/login" className="button">
              返回登录
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
