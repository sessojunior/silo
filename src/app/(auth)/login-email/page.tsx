"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { translateAuthError } from "@/lib/auth/i18n";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import { isValidCode, isValidEmail } from "@/lib/auth/validate";

import { toast } from "@/lib/toast";
import { useAuthFormState } from "@/hooks/useAuthFormState";

import AuthHeader from "@/components/auth/AuthHeader";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthLink from "@/components/auth/AuthLink";

import Label from "@/components/ui/Label";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pin from "@/components/ui/Pin";

export default function LoginEmailPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Etapa 1: Enviar código OTP
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const { error } = await authClient.emailOtp.sendVerificationOtp({
          email: normalizedEmail,
          type: "sign-in",
        });

        if (error) {
          const errorMessage = translateAuthError(
            error,
            "Erro ao enviar código.",
          );
          setFieldError("email", errorMessage);
          toast({
            type: "error",
            title: errorMessage,
          });
          return;
        }

        toast({
          type: "info",
          title: "Código enviado para seu e-mail.",
        });
        setStep(2);
      } catch (err) {
        console.error("❌ [PAGE_LOGIN_EMAIL] Erro inesperado:", { error: err });
        toast({
          type: "error",
          title: "Erro inesperado. Tente novamente.",
        });
        setFieldError(null, "Erro inesperado. Tente novamente.");
      }
    });
  };

  // Etapa 2: Verificar código e fazer login
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      return;
    }
    if (!isValidCode(code)) {
      setFieldError("code", "Digite o código com 6 caracteres.");
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const { error } = await authClient.signIn.emailOtp({
          email: normalizedEmail,
          otp: code,
        });

        if (error) {
          const errorMessage = translateAuthError(error, "Código inválido.");
          setFieldError("code", errorMessage);
          toast({
            type: "error",
            title: errorMessage,
          });
          return;
        }

        toast({
          type: "success",
          title: "Login realizado com sucesso!",
        });
        router.push(postLoginRedirectPath);
      } catch (err) {
        console.error("❌ [PAGE_LOGIN_EMAIL] Erro inesperado:", { error: err });
        toast({
          type: "error",
          title: "Erro inesperado. Tente novamente.",
        });
        setFieldError(null, "Erro inesperado. Tente novamente.");
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <AuthHeader
        icon="icon-[lucide--mail]"
        title={step === 1 ? "Acessar com e-mail" : "Verificar código"}
        description={
          step === 1
            ? "Enviaremos um código de acesso para você."
            : `Enviamos um código para ${email}`
        }
      />

      {step === 1 && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@inpe.br"
              value={email}
              setValue={setEmail}
              isInvalid={form.field === "email"}
              invalidMessage={form.field === "email" ? form.message : undefined}
              disabled={loading}
              required
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Continuar
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Código de verificação</Label>
            <Pin
              id="code"
              name="code"
              length={6}
              value={code}
              setValue={setCode}
              disabled={loading}
            />
            {form.field === "code" && (
              <span className="text-sm font-medium text-red-500">
                {form.message}
              </span>
            )}
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Voltar e alterar e-mail
          </button>
        </form>
      )}

      <AuthDivider>ou</AuthDivider>

      <div className="flex flex-col gap-4 text-center">
        <AuthLink href="/login">Entrar com senha</AuthLink>
        <AuthLink href="/register">Não tem uma conta? Cadastre-se</AuthLink>
      </div>
    </div>
  );
}
