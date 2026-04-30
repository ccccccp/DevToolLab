import type { AdminSession } from "./session";
import { getAdminUserById } from "@devtoollab/shared/api-client";



export async function resolveActiveAdminSession(session: AdminSession | null | undefined) {
  if (!session) {
    return null;
  }

  const user = await getAdminUserById(session.userId).catch(() => null);
  if (!user || user.status !== "active") {
    return null;
  }

  return {
    ...session,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status
  } satisfies AdminSession;
}
