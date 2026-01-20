"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { translateAuthError } from "@/lib/auth/i18n";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import { isValidCode, isValidEmail, isValidPassword } from "@/lib/auth/validate";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/api-response";

import { toast } from "@/lib/toast";
import { useAuthFormState } from "@/hooks/useAuthFormState";

import AuthHeader from "@/components/auth/AuthHeader";
import AuthLink from "@/components/auth/AuthLink";

import Label from "@/components/ui/Label";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import InputPasswordHints from "@/components/ui/InputPasswordHints";
import Pin from "@/components/ui/Pin";

export default function ForgetPasswordPage() {
  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  // Etapa 1: Enviar e-mail
  const handleSendEmail = async (e: React.FormEvent) => {
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
          type: "forget-password",
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
          title: "Agora só falta verificar seu e-mail.",
        });
        setStep(2);
      } catch (err) {
        console.error("❌ [PAGE_FORGET_PASSWORD] Erro inesperado:", {
          error: err,
        });
        toast({
          type: "error",
          title: "Erro inesperado. Tente novamente.",
        });
        setFieldError(null, "Erro inesperado. Tente novamente.");
      }
    });
  };

  // Etapa 2: Enviar código de verificação
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCode(code)) {
      setFieldError("code", "Digite o código com 6 caracteres.");
      return;
    }

    await withLoading(async () => {
      clearFieldError();
      setStep(3);
    });
  };

  // Etapa 3: Enviar a nova senha
  const handleSendPassword = async (e: React.FormEvent) => {
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
    if (!isValidPassword(password)) {
      setFieldError(
        "password",
        "A senha deve ter pelo menos 8 caracteres, com maiúsculas, minúsculas, número e caractere especial.",
      );
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/setup-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, code, password }),
        });

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao alterar a senha.";

        if (!res.ok) {
          setFieldError(data.field || null, message);
          toast({
            type: "error",
            title: message,
          });
          return;
        }

        toast({
          type: "success",
          title: "Senha alterada com sucesso.",
        });
        setStep(4);
      } catch (err) {
        console.error("❌ [PAGE_FORGET_PASSWORD] Erro ao alterar a senha:", {
          error: err,
        });
        toast({
          type: "error",
          title: "Erro ao alterar a senha.",
        });
        setFieldError(null, "Erro ao alterar a senha.");
      }
    });
  };

  return (
    <>
      {/* Header */}
      {step === 1 && (
        <AuthHeader
          icon="icon-[lucide--key-round]"
          title="Esqueceu a senha"
          description="Não se preocupe, iremos te ajudar a recuperar sua senha."
        />
      )}
      {step === 2 && (
        <AuthHeader
          icon="icon-[lucide--square-asterisk]"
          title="Verifique a conta"
          description="Para sua segurança, insira o código que recebeu por e-mail."
        />
      )}
      {step === 3 && (
        <AuthHeader
          icon="icon-[lucide--lock]"
          title="Redefinir a senha"
          description="Agora você precisa digitar a nova senha para sua conta."
        />
      )}
      {step === 4 && (
        <AuthHeader
          icon="icon-[lucide--lock-keyhole]"
          title="Senha alterada"
          description="A sua senha foi alterada com sucesso! Volte para continuar."
        />
      )}

      {/* Container */}
      <div className="mt-10 text-base text-zinc-600 dark:text-zinc-200">
        {/* Etapa 1: Inserir e-mail para enviar o código OTP para o e-mail */}
        {step === 1 && (
          <>
            <form onSubmit={handleSendEmail}>
              <fieldset className="grid gap-5" disabled={loading}>
                <div>
                  <Label htmlFor="email" isInvalid={form?.field === "email"}>
                    E-mail
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    setValue={setEmail}
                    autoComplete="email"
                    placeholder="seuemail@inpe.br"
                    minLength={8}
                    maxLength={255}
                    required
                    autoFocus
                    isInvalid={form?.field === "email"}
                    invalidMessage={form?.message ?? ""}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <span className="icon-[lucide--loader-circle] animate-spin"></span>{" "}
                        Enviando...
                      </>
                    ) : (
                      <>Enviar instruções</>
                    )}
                  </Button>
                </div>
                <p className="text-center">
                  <AuthLink href="/login">Voltar</AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}

        {/* Etapa 2: Enviar código OTP para verificar se está correto */}
        {step === 2 && (
          <>
            <form onSubmit={handleVerifyCode}>
              <fieldset className="grid gap-5" disabled={loading}>
                <input type="hidden" name="email" value={email} />
                <div>
                  <Label htmlFor="code" isInvalid={form?.field === "code"}>
                    Código recebdio por e-mail
                  </Label>
                  <Pin
                    id="code"
                    name="code"
                    length={6}
                    value={code}
                    setValue={setCode}
                    isInvalid={form?.field === "code"}
                    invalidMessage={form?.message ?? ""}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <span className="icon-[lucide--loader-circle] animate-spin"></span>{" "}
                        Enviando...
                      </>
                    ) : (
                      <>Enviar código</>
                    )}
                  </Button>
                </div>
                <p className="text-center">
                  <AuthLink href="/login">Voltar</AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}

        {/* Etapa 3: Enviar nova senha para alteração */}
        {step === 3 && (
          <>
            <form onSubmit={handleSendPassword}>
              <fieldset className="grid gap-5" disabled={loading}>
                <input type="hidden" name="email" value={email} />
                <div>
                  <Label
                    htmlFor="password"
                    isInvalid={form?.field === "password"}
                  >
                    Nova senha
                  </Label>
                  <InputPasswordHints
                    id="password"
                    name="password"
                    value={password}
                    setValue={setPassword}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    minLength={8}
                    maxLength={160}
                    required
                    isInvalid={form?.field === "password"}
                    invalidMessage={form?.message}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <span className="icon-[lucide--loader-circle] animate-spin"></span>{" "}
                        Redefinindo...
                      </>
                    ) : (
                      <>Redefinir senha</>
                    )}
                  </Button>
                </div>
                <p className="text-center">
                  <AuthLink href="/login">Voltar</AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}

        {/* Etapa 4: Senha alterada com sucesso */}
        {step === 4 && (
          <>
            <div className="grid gap-5">
              <div>
                <Button
                  href={postLoginRedirectPath}
                  type="button"
                  className="w-full"
                >
                  Ir para o painel
                </Button>
              </div>
              <p className="text-center">
                <AuthLink href="/login">Voltar</AuthLink>
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
