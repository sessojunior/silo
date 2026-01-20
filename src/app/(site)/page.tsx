import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { postLoginRedirectPath } from "@/lib/auth/urls";

export default async function HomePage() {
  const user = await getAuthUser();
  redirect(user ? postLoginRedirectPath : "/login");
}
