import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  redirect("/admin/dashboard");
}
