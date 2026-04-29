"use client";

import { useRef, type ReactNode } from "react";
import type { AdminUserRecord } from "@devtoollab/shared";
import { createUserAction, resetPasswordAction, updateUserStatusAction } from "./actions";

function formatDate(value: string | null) {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function DialogShell({
  buttonLabel,
  title,
  description,
  buttonClassName = "button",
  children
}: {
  buttonLabel: string;
  title: string;
  description: string;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openDialog() {
    requestAnimationFrame(() => {
      dialogRef.current?.showModal();
    });
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" className={buttonClassName} onClick={openDialog}>
        {buttonLabel}
      </button>
      <dialog ref={dialogRef} className="review-dialog users-dialog">
        <div className="review-dialog-panel">
          <div className="review-dialog-header">
            <div>
              <p className="eyebrow">用户管理</p>
              <h3>{title}</h3>
            </div>
            <button type="button" className="dialog-close" onClick={closeDialog} aria-label="关闭弹框">
              ×
            </button>
          </div>

          <p className="muted">{description}</p>
          {children}
        </div>
      </dialog>
    </>
  );
}

function CreateUserDialog() {
  return (
    <DialogShell
      buttonLabel="创建用户"
      title="创建后台用户"
      description="创建一个新的后台账号，提交后会立即写入用户列表。"
      buttonClassName="button primary-button"
    >
      <form action={createUserAction} className="editor-form dialog-form">
        <div className="field-grid">
          <label className="field">
            <span>显示名称</span>
            <input type="text" name="displayName" required placeholder="内容编辑" />
          </label>
          <label className="field">
            <span>邮箱</span>
            <input type="email" name="email" required placeholder="editor@devtoollab.com" />
          </label>
          <label className="field">
            <span>初始密码</span>
            <input type="password" name="password" required minLength={8} placeholder="至少 8 位" />
          </label>
          <label className="field">
            <span>角色</span>
            <select name="role" defaultValue="editor">
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
        </div>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            创建用户
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function UserDetailDialog({ user }: { user: AdminUserRecord }) {
  return (
    <DialogShell
      buttonLabel="查看详情"
      title={user.displayName}
      description="查看账号信息，并在这里完成启用/禁用和重置密码。"
    >
      <div className="user-detail-grid">
        <div className="user-detail-item">
          <span className="user-detail-label">用户 ID</span>
          <strong>{user.id}</strong>
        </div>
        <div className="user-detail-item">
          <span className="user-detail-label">邮箱</span>
          <strong>{user.email}</strong>
        </div>
        <div className="user-detail-item">
          <span className="user-detail-label">角色</span>
          <strong>{user.role}</strong>
        </div>
        <div className="user-detail-item">
          <span className="user-detail-label">状态</span>
          <strong>{user.status}</strong>
        </div>
        <div className="user-detail-item">
          <span className="user-detail-label">创建时间</span>
          <strong>{formatDate(user.createdAt)}</strong>
        </div>
        <div className="user-detail-item">
          <span className="user-detail-label">最近登录</span>
          <strong>{formatDate(user.lastLoginAt)}</strong>
        </div>
        <div className="user-detail-item user-detail-item-wide">
          <span className="user-detail-label">最近更新</span>
          <strong>{formatDate(user.updatedAt)}</strong>
        </div>
      </div>

      <div className="user-detail-actions">
        <form action={updateUserStatusAction} className="inline-form">
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="status" value={user.status === "active" ? "disabled" : "active"} />
          <button type="submit" className="button">
            {user.status === "active" ? "禁用账号" : "启用账号"}
          </button>
        </form>

        <form action={resetPasswordAction} className="editor-form dialog-inline-form">
          <input type="hidden" name="id" value={user.id} />
          <label className="field">
            <span>重置密码</span>
            <input type="password" name="password" minLength={8} required placeholder="输入新密码" />
          </label>
          <button type="submit" className="button">
            保存新密码
          </button>
        </form>
      </div>
    </DialogShell>
  );
}

export function UsersManager({ users }: { users: AdminUserRecord[] }) {
  return (
    <section className="admin-section">
      <div className="section-header users-page-header">
        <div>
          <span className="eyebrow">用户管理</span>
          <h1>后台用户管理</h1>
          <p className="muted">创建、禁用、重置密码都在这里完成，普通用户只能访问自己的账户页。</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="users-table-wrap card">
        <table className="users-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>最近登录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-table-main">
                    <strong>{user.displayName}</strong>
                    <span>{user.id}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <span className="table-chip">{user.role}</span>
                </td>
                <td>
                  <span className={`status ${user.status}`}>{user.status}</span>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(user.lastLoginAt)}</td>
                <td>
                  <div className="table-actions">
                    <UserDetailDialog user={user} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
