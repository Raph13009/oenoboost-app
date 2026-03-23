import { getCurrentUser } from "@/lib/auth/session";
import { HeaderClient } from "./header-client";

export async function Header() {
  const user = await getCurrentUser();
  return <HeaderClient user={user} />;
}
