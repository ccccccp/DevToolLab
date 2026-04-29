import { redirect } from "next/navigation";
import { listAdminUsers } from "@devtoollab/shared/api-client";
import { getCurrentAdminSession } from "../../lib/server-session";
import { UsersManager } from "./users-manager";

type UsersPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "admin") {
    redirect("/account");
  }

  const { error } = await searchParams;
  const users = await listAdminUsers();

  return (
    <>
      {error ? <p className="auth-alert">{error}</p> : null}
      <UsersManager users={users} />
    </>
  );
}
