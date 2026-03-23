import { redirect } from "next/navigation";

export default function RegisterLegacyRedirect() {
  redirect("/signup");
}
