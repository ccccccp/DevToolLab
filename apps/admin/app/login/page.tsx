import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "../../lib/server-session";
import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentAdminSession();
  if (session) {
    redirect("/");
  }

  const { error, next } = await searchParams;

  return (
    <section className="auth-shell">
      <article className="card auth-card">
        <span className="eyebrow">Admin Login</span>
        <h1>登录后台</h1>
        <p className="muted">登录后可以管理文章、工具、采集源和后台用户。</p>

        {error ? <p className="auth-alert">{error}</p> : null}

        <form action={loginAction} className="editor-form auth-form">
          <input type="hidden" name="next" value={next ?? "/"} />
          <label className="field">
            <span>邮箱</span>
            <input type="email" name="email" required placeholder="admin@devtoollab.com" />
          </label>
          <label className="field">
            <span>密码</span>
            <input type="password" name="password" required placeholder="请输入密码" />
          </label>
          <div className="actions-row">
            <button type="submit" className="button primary-button">
              登录
            </button>
            <Link href="/register" className="button">
              首次注册
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
