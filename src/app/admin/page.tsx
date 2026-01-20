import { redirect } from "next/navigation";
import { postLoginRedirectPath } from "@/lib/auth/urls";

export default function AdminPage() {
  // Redireciona automaticamente para o dashboard
  redirect(postLoginRedirectPath);
}
