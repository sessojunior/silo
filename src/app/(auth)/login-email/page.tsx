"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import { isValidCode, isValidEmail } from "@/lib/auth/validate";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/api-response";
import {
  computeSecondsLeftFromUnlockAtMs,
  createSessionResendCooldown,
} from "@/lib/utils";

import { toast } from "@/lib/toast";
import { useAuthFormState } from "@/hooks/useAuthFormState";

import AuthHeader from "@/components/auth/AuthHeader";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthLink from "@/components/auth/AuthLink";

import Label from "@/components/ui/Label";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pin from "@/components/ui/Pin";

const resendCooldown = createSessionResendCooldown("login-email");

export default function LoginEmailPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (step !== 1 && step !== 2) return;
    const update = () => {
      const unlockAtMs = resendCooldown.readUnlockAtMs(email);
      setResendSecondsLeft(
        unlockAtMs ? computeSecondsLeftFromUnlockAtMs(unlockAtMs) : 0,
      );
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

  // Etapa 1: Enviar código OTP
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      return;
    }
    if (resendSecondsLeft > 0) {
      setFieldError("email", "Aguarde para reenviar o código.");
      toast({
        type: "info",
        title: "Aguarde para reenviar o código.",
        description: `Tente novamente em ${resendSecondsLeft}s.`,
      });
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/login-email/send-otp"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao enviar código.";

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
            resendCooldown.writeUnlockAtMsFromSeconds(normalizedEmail, retryAfter);
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

        const cooldownSeconds = (() => {
          if (typeof data.data !== "object" || data.data === null) return null;
          if (!("cooldownSeconds" in data.data)) return null;
          const raw = (data.data as { cooldownSeconds?: unknown }).cooldownSeconds;
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
            return null;
          return Math.ceil(raw);
        })();

        toast({ type: "info", title: message });
        setEmail(normalizedEmail);
        setCode("");
        resendCooldown.writeUnlockAtMsFromSeconds(
          normalizedEmail,
          cooldownSeconds ?? 90,
        );
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

  const handleResendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      setStep(1);
      return;
    }

    if (resendSecondsLeft > 0) return;

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/login-email/send-otp"), {
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
            resendCooldown.writeUnlockAtMsFromSeconds(normalizedEmail, retryAfter);
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
          const raw = (data.data as { cooldownSeconds?: unknown }).cooldownSeconds;
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
            return null;
          return Math.ceil(raw);
        })();

        setCode("");
        resendCooldown.writeUnlockAtMsFromSeconds(
          normalizedEmail,
          cooldownSeconds ?? 90,
        );
        toast({ type: "info", title: message });
      } catch (err) {
        console.error("❌ [PAGE_LOGIN_EMAIL] Erro ao reenviar código:", {
          error: err,
        });
        toast({ type: "error", title: "Erro ao reenviar código." });
        setFieldError(null, "Erro ao reenviar código.");
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
        const res = await fetch(config.getApiUrl("/api/auth/login-email/verify-otp"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, code }),
        });

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
            setFieldError("email", message);
            toast({ type: "error", title: message });
            return;
          }

          setFieldError(data.field || "code", message);
          toast({ type: "error", title: message });
          return;
        }

        toast({ type: "success", title: message });
        setCode("");
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

  const emailInvalidMessage =
    form?.field === "email" &&
    form?.message === "Aguarde para reenviar o código." &&
    resendSecondsLeft > 0
      ? `Aguarde ${resendSecondsLeft} segundos para reenviar o código.`
      : (form?.message ?? "");

  return (
    <div className="flex w-full flex-col gap-6">
      <AuthHeader
        icon="icon-[lucide--mail]"
        title={step === 1 ? "Acessar com e-mail" : "Verificar código"}
        description={
          step === 1
            ? "Enviaremos um código de acesso para você por e-mail."
            : `Enviamos um código para ${email}`
        }
      />

      {step === 1 && (
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <Label htmlFor="email" isInvalid={form.field === "email"}>
              E-mail corporativo
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@inpe.br"
              value={email}
              setValue={setEmail}
              isInvalid={form.field === "email"}
              invalidMessage={form.field === "email" ? emailInvalidMessage : undefined}
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
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <Label htmlFor="code" isInvalid={form.field === "code"}>
              Código de verificação
            </Label>
            <Pin
              id="code"
              name="code"
              length={6}
              value={code}
              setValue={setCode}
              disabled={loading}
              isInvalid={form.field === "code"}
              invalidMessage={form.message}
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>

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

          <button
            type="button"
            onClick={() => {
              clearFieldError();
              setCode("");
              setStep(1);
            }}
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
