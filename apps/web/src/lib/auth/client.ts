import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { getAuthClientBaseURL } from "@/lib/auth/urls";

export const authClient = createAuthClient({
  baseURL: getAuthClientBaseURL(),
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, useSession } = authClient;
