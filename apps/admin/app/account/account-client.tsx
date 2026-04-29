"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { beginRequest, toast } from "@devtoollab/shared";

type AccountSession = {
  displayName: string;
  email: string;
  role: string;
  status: string;
  issuedAt: string;
};

type AccountClientProps = {
  session: AccountSession;
};

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || "操作失败";
  } catch {
    return "操作失败";
  }
}

export function AccountClient({ session }: AccountClientProps) {
  const router = useRouter();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (!displayName) {
      toast.error("用户名不能为空");
      return;
    }

    setProfileSaving(true);
    const endRequest = beginRequest();
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ displayName })
      });

      if (!response.ok) {
        toast.error(await readErrorMessage(response));
        return;
      }

      toast.success("修改成功");
      router.refresh();
    } catch {
      toast.error("网络异常，用户名修改失败");
    } finally {
      endRequest();
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "").trim();
    if (!password) {
      toast.error("密码不能为空");
      return;
    }

    setPasswordSaving(true);
    const endRequest = beginRequest();
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        toast.error(await readErrorMessage(response));
        return;
      }

      toast.success("修改成功");
      event.currentTarget.reset();
      router.refresh();
    } catch {
      toast.error("网络异常，密码修改失败");
    } finally {
      endRequest();
      setPasswordSaving(false);
    }
  }

  return (
    <div className="split-layout users-layout">
      <article className="card">
        <span className="eyebrow">账户信息</span>
        <h3>修改账户资料</h3>
        <form onSubmit={handleProfileSubmit} className="editor-form compact-editor-form">
          <label className="field">
            <span>用户名</span>
            <input type="text" name="displayName" required defaultValue={session.displayName} />
          </label>
          <button type="submit" className="button primary-button" disabled={profileSaving}>
            {profileSaving ? "保存中..." : "保存用户名"}
          </button>
        </form>

        <div className="account-meta">
          <p className="meta-line">{session.email}</p>
          <p className="meta-line">角色：{session.role}</p>
          <p className="meta-line">状态：{session.status}</p>
          <p className="meta-line">登录时间：{new Date(session.issuedAt).toLocaleString("zh-CN")}</p>
        </div>
      </article>

      <article className="card">
        <span className="eyebrow">安全设置</span>
        <h3>修改我的密码</h3>
        <form onSubmit={handlePasswordSubmit} className="editor-form compact-editor-form">
          <label className="field">
            <span>新密码</span>
            <input type="password" name="password" required minLength={8} placeholder="至少 8 位" />
          </label>
          <button type="submit" className="button primary-button" disabled={passwordSaving}>
            {passwordSaving ? "保存中..." : "保存密码"}
          </button>
        </form>
      </article>
    </div>
  );
}
