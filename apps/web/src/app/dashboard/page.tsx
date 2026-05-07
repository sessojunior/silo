import { redirect } from "next/navigation";
import { postLoginRedirectPath } from "@/lib/auth/urls";

export default function DashboardRedirectPage() {
  redirect(postLoginRedirectPath);
}