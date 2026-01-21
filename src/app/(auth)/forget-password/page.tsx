"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const getResendStorageKey = (email: string): string =>
  `forget-password:resend-unlock-at:${email}`;

const readResendUnlockAtMs = (email: string): number | null => {
  if (typeof window === "undefined") return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const raw = window.sessionStorage.getItem(getResendStorageKey(normalizedEmail));
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const writeResendUnlockAtMs = (email: string, seconds: number) => {
  if (typeof window === "undefined") return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const unlockAtMs = Date.now() + safeSeconds * 1000;
  window.sessionStorage.setItem(getResendStorageKey(normalizedEmail), String(unlockAtMs));
};

const computeSecondsLeft = (unlockAtMs: number): number =>
  Math.max(0, Math.ceil((unlockAtMs - Date.now()) / 1000));

export default function ForgetPasswordPage() {
  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [canGoToDashboard, setCanGoToDashboard] = useState(false);

  useEffect(() => {
    if (step !== 1 && step !== 2) return;
    const update = () => {
      const unlockAtMs = readResendUnlockAtMs(email);
      setResendSecondsLeft(unlockAtMs ? computeSecondsLeft(unlockAtMs) : 0);
    };
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [email, step]);

  useEffect(() => {
    if (resendSecondsLeft > 0) return;
    if (form.field !== "email") return;
    if (form.message !== "Aguarde para reenviar o código.") return;
    clearFieldError();
  }, [clearFieldError, form.field, form.message, resendSecondsLeft]);

  const shouldResetFlow = (params: {
    status: number;
    message: string;
    data: unknown;
  }): boolean => {
    if (params.status === 429) return true;
    if (params.message === "Excesso tentativas inválidas. Comece novamente.")
      return true;
    if (typeof params.data !== "object" || params.data === null) return false;
    if (!("resetFlow" in params.data)) return false;
    return (params.data as { resetFlow?: unknown }).resetFlow === true;
  };

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
        const res = await fetch(config.getApiUrl("/api/auth/forget-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        const data = (await res.json()) as ApiResponse<{
          step: number;
          email: string;
          cooldownSeconds?: number;
        }>;
        const message = data.message || data.error || "Erro ao enviar código.";

        if (!res.ok) {
          const retryAfterSeconds = (() => {
            if (typeof data.data !== "object" || data.data === null) return null;
            if (!("retryAfterSeconds" in data.data)) return null;
            const raw = (data.data as { retryAfterSeconds?: unknown })
              .retryAfterSeconds;
            if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
              return null;
            return Math.ceil(raw);
          })();

          const retryAfterFromHeader = (() => {
            const raw = res.headers.get("Retry-After");
            if (!raw) return null;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed <= 0) return null;
            return Math.ceil(parsed);
          })();

          const retryAfter = retryAfterSeconds ?? retryAfterFromHeader;
          if (res.status === 429 && retryAfter) {
            writeResendUnlockAtMs(normalizedEmail, retryAfter);
            setFieldError("email", "Aguarde para reenviar o código.");
            toast({
              type: "info",
              title: message,
              description: `Tente novamente em ${retryAfter}s.`,
            });
            return;
          }

          setFieldError(data.field || "email", message);
          toast({ type: "error", title: message });
          return;
        }

        toast({ type: "info", title: message, description: "Verifique seu e-mail." });
        setEmail(normalizedEmail);
        setCode("");
        setPassword("");
        setCanGoToDashboard(false);
        const initialCooldownSeconds = data.data?.cooldownSeconds ?? 90;
        writeResendUnlockAtMs(normalizedEmail, initialCooldownSeconds);
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
        const res = await fetch(
          config.getApiUrl("/api/auth/forget-password/verify-otp"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, code }),
          },
        );

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao verificar código.";

        if (!res.ok) {
          if (
            shouldResetFlow({
              status: res.status,
              message,
              data: data.data,
            })
          ) {
            setStep(1);
            setCode("");
            setPassword("");
            setCanGoToDashboard(false);
            setFieldError("email", message);
            toast({
              type: "error",
              title: message,
            });
            return;
          }

          setFieldError(data.field || "code", message);
          toast({
            type: "error",
            title: message,
          });
          return;
        }

        setStep(3);
      } catch (err) {
        console.error("❌ [PAGE_FORGET_PASSWORD] Erro ao verificar código:", {
          error: err,
        });
        toast({
          type: "error",
          title: "Erro ao verificar código.",
        });
        setFieldError("code", "Erro ao verificar código.");
      }
    });
  };

  const handleResendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      setCanGoToDashboard(false);
      setStep(1);
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/forget-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, resend: true }),
        });

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao reenviar código.";

        const retryAfterSeconds = (() => {
          if (typeof data.data !== "object" || data.data === null) return null;
          if (!("retryAfterSeconds" in data.data)) return null;
          const raw = (data.data as { retryAfterSeconds?: unknown })
            .retryAfterSeconds;
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
            return null;
          return Math.ceil(raw);
        })();

        const retryAfterFromHeader = (() => {
          const raw = res.headers.get("Retry-After");
          if (!raw) return null;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed <= 0) return null;
          return Math.ceil(parsed);
        })();

        if (!res.ok) {
          const retryAfter = retryAfterSeconds ?? retryAfterFromHeader;
          if (res.status === 429 && retryAfter) {
            writeResendUnlockAtMs(normalizedEmail, retryAfter);
            toast({
              type: "info",
              title: message,
              description: `Tente novamente em ${retryAfter}s.`,
            });
            return;
          }

          toast({ type: "error", title: message });
          setFieldError(null, message);
          return;
        }

        const cooldownSeconds = (() => {
          if (typeof data.data !== "object" || data.data === null) return null;
          if (!("cooldownSeconds" in data.data)) return null;
          const raw = (data.data as { cooldownSeconds?: unknown })
            .cooldownSeconds;
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
            return null;
          return Math.ceil(raw);
        })();

        setCode("");
        writeResendUnlockAtMs(normalizedEmail, cooldownSeconds ?? 90);
        toast({ type: "info", title: message });
      } catch (err) {
        console.error("❌ [PAGE_FORGET_PASSWORD] Erro ao reenviar código:", {
          error: err,
        });
        toast({ type: "error", title: "Erro ao reenviar código." });
        setFieldError(null, "Erro ao reenviar código.");
      }
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
          body: JSON.stringify({
            email: normalizedEmail,
            code,
            password,
            autoSignIn: true,
          }),
        });

        const data = (await res.json()) as ApiResponse<{
          signedIn?: unknown;
        }>;
        const message = data.message || data.error || "Erro ao alterar a senha.";

        if (!res.ok) {
          if (
            shouldResetFlow({
              status: res.status,
              message,
              data: data.data,
            })
          ) {
            setStep(1);
            setCode("");
            setPassword("");
            setCanGoToDashboard(false);
            setFieldError("email", message);
            toast({
              type: "error",
              title: message,
            });
            return;
          }

          setFieldError(data.field || null, message);
          toast({
            type: "error",
            title: message,
          });
          return;
        }

        const signedIn =
          typeof data.data === "object" &&
          data.data !== null &&
          "signedIn" in data.data &&
          (data.data as { signedIn?: unknown }).signedIn === true;

        if (signedIn) {
          toast({
            type: "success",
            title: "Senha alterada com sucesso.",
          });
          setCanGoToDashboard(true);
          setPassword("");
          router.replace(postLoginRedirectPath);
          return;
        }

        const { error: signInError } = await authClient.signIn.email({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          const signInMessage = translateAuthError(
            signInError,
            "Senha alterada, mas não foi possível criar a sessão. Faça login novamente.",
          );
          setCanGoToDashboard(false);
          toast({
            type: "error",
            title: signInMessage,
          });
          setStep(4);
          return;
        }

        toast({
          type: "success",
          title: "Senha alterada com sucesso.",
        });
        setCanGoToDashboard(true);
        setPassword("");
        router.replace(postLoginRedirectPath);
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

  const emailInvalidMessage =
    form?.field === "email" &&
    form?.message === "Aguarde para reenviar o código." &&
    resendSecondsLeft > 0
      ? `Aguarde ${resendSecondsLeft} segundos para reenviar o código.`
      : (form?.message ?? "");

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
                    invalidMessage={emailInvalidMessage}
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
                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading || resendSecondsLeft > 0}
                    className="font-semibold underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    {resendSecondsLeft > 0
                      ? `Você pode reenviar o código em ${resendSecondsLeft}s`
                      : "Reenviar o código novamente"}
                  </button>
                </div>
                {resendSecondsLeft > 0 && (
                  <p className="text-center text-xs text-zinc-500 dark:text-zinc-300">
                    Aguarde {resendSecondsLeft}s para reenviar o código.
                  </p>
                )}
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
                  href={canGoToDashboard ? postLoginRedirectPath : "/login"}
                  type="button"
                  className="w-full"
                >
                  {canGoToDashboard ? "Ir para o painel" : "Ir para login"}
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
