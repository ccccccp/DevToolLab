import type { AdminUserRecord } from "@devtoollab/shared";
import { exec, first, nowIso, run, sha256 } from "./db";
import type { SqlRow } from "./types";

export type AdminUserInput = {
  email: string;
  displayName: string;
  password: string;
  role?: AdminUserRecord["role"];
  status?: AdminUserRecord["status"];
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function mapAdminUser(row: SqlRow): AdminUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name ?? ""),
    role: String(row.role) as AdminUserRecord["role"],
    status: String(row.status) as AdminUserRecord["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  };
}

async function hashPassword(password: string, salt = crypto.randomUUID().replace(/-/g, "")) {
  return {
    salt,
    hash: await sha256(`${salt}:${password}`)
  };
}

export async function listAdminUsers(db: D1Database) {
  const rows = await run<SqlRow>(db, "SELECT * FROM admin_users ORDER BY created_at ASC");
  return rows.map(mapAdminUser);
}

export async function countAdminUsers(db: D1Database) {
  const row = await first<{ total: number }>(db, "SELECT COUNT(*) AS total FROM admin_users");
  return Number(row?.total ?? 0);
}

export async function getAdminUserById(db: D1Database, id: string) {
  const row = await first<SqlRow>(db, "SELECT * FROM admin_users WHERE id = ?", [id]);
  return row ? mapAdminUser(row) : null;
}

async function getAdminUserRowByEmail(db: D1Database, email: string) {
  return first<SqlRow>(db, "SELECT * FROM admin_users WHERE email = ?", [normalizeEmail(email)]);
}

export async function verifyAdminPassword(db: D1Database, email: string, password: string) {
  const row = await getAdminUserRowByEmail(db, email);
  if (!row) {
    return null;
  }

  if (String(row.status) !== "active") {
    return null;
  }

  const salt = String(row.password_salt ?? "");
  const hash = String(row.password_hash ?? "");
  const derived = await sha256(`${salt}:${password}`);

  if (!salt || !hash || hash !== derived) {
    return null;
  }

  const timestamp = nowIso();
  await exec(db, "UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?", [
    timestamp,
    timestamp,
    String(row.id)
  ]);

  const refreshed = await first<SqlRow>(db, "SELECT * FROM admin_users WHERE id = ?", [String(row.id)]);
  return refreshed ? mapAdminUser(refreshed) : mapAdminUser(row);
}

export async function createAdminUser(db: D1Database, input: AdminUserInput) {
  const timestamp = nowIso();
  const id = `user_${crypto.randomUUID()}`;
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const role = input.role ?? "admin";
  const status = input.status ?? "active";
  const { salt, hash } = await hashPassword(input.password);

  await exec(
    db,
    `INSERT INTO admin_users (
      id, email, display_name, role, status, password_salt, password_hash, last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [id, email, displayName, role, status, salt, hash, timestamp, timestamp]
  );

  const saved = await first<SqlRow>(db, "SELECT * FROM admin_users WHERE id = ?", [id]);
  if (!saved) {
    throw new Error("Admin user was saved but could not be reloaded");
  }

  return mapAdminUser(saved);
}

export async function bootstrapAdminUser(db: D1Database, input: AdminUserInput) {
  const total = await countAdminUsers(db);
  if (total > 0) {
    return null;
  }

  return createAdminUser(db, input);
}

export async function updateAdminUserStatus(db: D1Database, id: string, status: AdminUserRecord["status"]) {
  const timestamp = nowIso();
  await exec(db, "UPDATE admin_users SET status = ?, updated_at = ? WHERE id = ?", [status, timestamp, id]);
  return getAdminUserById(db, id);
}

export async function updateAdminUserPassword(db: D1Database, id: string, password: string) {
  const timestamp = nowIso();
  const { salt, hash } = await hashPassword(password);
  await exec(
    db,
    "UPDATE admin_users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?",
    [salt, hash, timestamp, id]
  );
  return getAdminUserById(db, id);
}

export async function updateAdminUserDisplayName(db: D1Database, id: string, displayName: string) {
  const timestamp = nowIso();
  await exec(db, "UPDATE admin_users SET display_name = ?, updated_at = ? WHERE id = ?", [
    displayName.trim(),
    timestamp,
    id
  ]);
  return getAdminUserById(db, id);
}
