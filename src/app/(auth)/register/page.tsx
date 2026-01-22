"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import type { ApiResponse } from "@/lib/api-response";
import { config } from "@/lib/config";
import {
  isValidCode,
  isValidEmail,
  isValidName,
  isValidPassword,
} from "@/lib/auth/validate";
import { AUTH_OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/rate-limits";
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
import InputPasswordHints from "@/components/ui/InputPasswordHints";
import Pin from "@/components/ui/Pin";

const signUpCooldown = createSessionResendCooldown("sign-up-email");
const verificationCooldown = createSessionResendCooldown("register-email-verification");

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [signUpSecondsLeft, setSignUpSecondsLeft] = useState(0);
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0);
  const [mustResendVerificationCode, setMustResendVerificationCode] =
    useState(false);

  useEffect(() => {
    if (step !== 1) return;
    const update = () => {
      const normalizedEmail = email.trim().toLowerCase();
      const unlockAtMs = signUpCooldown.readUnlockAtMs(normalizedEmail);
      setSignUpSecondsLeft(
        unlockAtMs ? computeSecondsLeftFromUnlockAtMs(unlockAtMs) : 0,
      );
    };
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [email, step]);

  useEffect(() => {
    if (signUpSecondsLeft > 0) return;
    if (form.field !== "email") return;
    if (form.message !== "Aguarde para tentar novamente.") return;
    clearFieldError();
  }, [clearFieldError, form.field, form.message, signUpSecondsLeft]);

  useEffect(() => {
    if (step !== 2) return;
    const update = () => {
      const normalizedEmail = email.trim().toLowerCase();
      const unlockAtMs = verificationCooldown.readUnlockAtMs(normalizedEmail);
      setVerificationSecondsLeft(
        unlockAtMs ? computeSecondsLeftFromUnlockAtMs(unlockAtMs) : 0,
      );
    };
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [email, step]);

  useEffect(() => {
    if (verificationSecondsLeft > 0) return;
    if (form.field !== "code") return;
    if (form.message !== "Aguarde para reenviar o código.") return;
    clearFieldError();
  }, [clearFieldError, form.field, form.message, verificationSecondsLeft]);

  useEffect(() => {
    if (step !== 2) setMustResendVerificationCode(false);
  }, [step]);

  const shouldResetFlow = (data: unknown): boolean => {
    if (typeof data !== "object" || data === null) return false;
    if (!("resetFlow" in data)) return false;
    return (data as { resetFlow?: unknown }).resetFlow === true;
  };

  // Etapa 1: Criar conta
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const formatEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    // Validações básicas
    if (!isValidName(normalizedName)) {
      setFieldError("name", "Digite um nome válido.");
      return;
    }
    if (!isValidEmail(formatEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      return;
    }
    if (!isValidPassword(password)) {
      setFieldError(
        "password",
        "A senha deve ter pelo menos 8 caracteres, com maiúsculas, minúsculas, número e caractere especial.",
      );
      return;
    }
    if (signUpSecondsLeft > 0) {
      setFieldError("email", "Aguarde para tentar novamente.");
      toast({
        type: "info",
        title: "Aguarde para tentar novamente.",
        description: `Tente novamente em ${signUpSecondsLeft}s.`,
      });
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/sign-up/email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: normalizedName,
            email: formatEmail,
            password,
          }),
        });

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao criar conta.";

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
            signUpCooldown.writeUnlockAtMsFromSeconds(formatEmail, retryAfter);
            setFieldError("email", "Aguarde para tentar novamente.");
            toast({
              type: "info",
              title: message,
              description: `Tente novamente em ${retryAfter}s.`,
            });
            return;
          }

          setFieldError(data.field || null, message);
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

        toast({
          type: "success",
          title: message,
        });
        signUpCooldown.writeUnlockAtMsFromSeconds(
          formatEmail,
          cooldownSeconds ?? AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        );
        verificationCooldown.writeUnlockAtMsFromSeconds(
          formatEmail,
          cooldownSeconds ?? AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        );
        setMustResendVerificationCode(false);
        setEmail(formatEmail);
        setStep(2);
      } catch (err) {
        console.error("❌ [PAGE_REGISTER] Erro inesperado:", { error: err });
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

    const formatEmail = email.trim().toLowerCase();

    if (!isValidCode(code)) {
      setFieldError("code", "Digite o código com 6 caracteres.");
      return;
    }

    if (mustResendVerificationCode) return;

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(
          config.getApiUrl("/api/auth/sign-up/email/verify-otp"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formatEmail,
              code,
              password,
              autoSignIn: true,
            }),
          },
        );

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao verificar código.";

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
            verificationCooldown.writeUnlockAtMsFromSeconds(formatEmail, retryAfter);
            setMustResendVerificationCode(true);
            setCode("");
            setFieldError("code", "Aguarde para reenviar o código.");
            toast({
              type: "info",
              title: "Aguarde para reenviar o código.",
              description: `Clique em "Reenviar o código novamente" para receber um novo código. Tente novamente em ${retryAfter}s.`,
              duration: 60,
            });
            return;
          }

          if (
            shouldResetFlow(data.data)
          ) {
            setCode("");
            setFieldError("code", message);
            toast({ type: "error", title: message });
            return;
          }

          setFieldError(data.field || "code", message);
          toast({ type: "error", title: message });
          return;
        }

        toast({
          type: "success",
          title: "Conta verificada com sucesso.",
        });

        router.push(postLoginRedirectPath);
      } catch (err) {
        console.error("❌ [PAGE_REGISTER] Erro ao verificar o código:", {
          error: err,
        });
        toast({
          type: "error",
          title: "Erro ao verificar o código.",
        });
        setFieldError(null, "Erro ao verificar o código.");
      }
    });
  };

  const handleResendCode = async () => {
    setCode("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      setStep(1);
      return;
    }

    if (verificationSecondsLeft > 0) return;

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/sign-up/email/send-otp"), {
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
            verificationCooldown.writeUnlockAtMsFromSeconds(
              normalizedEmail,
              retryAfter,
            );
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
        verificationCooldown.writeUnlockAtMsFromSeconds(
          normalizedEmail,
          cooldownSeconds ?? AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        );
        setMustResendVerificationCode(false);
        toast({ type: "info", title: message });
      } catch (err) {
        console.error("❌ [PAGE_REGISTER] Erro ao reenviar código:", { error: err });
        toast({ type: "error", title: "Erro ao reenviar código." });
        setFieldError(null, "Erro ao reenviar código.");
      }
    });
  };

  const emailInvalidMessage =
    form?.field === "email" &&
    form?.message === "Aguarde para tentar novamente." &&
    signUpSecondsLeft > 0
      ? `Aguarde ${signUpSecondsLeft} segundos para tentar novamente.`
      : (form?.message ?? "");

  const codeInvalidMessage =
    form?.field === "code" &&
    form?.message === "Aguarde para reenviar o código." &&
    verificationSecondsLeft > 0
      ? `Aguarde ${verificationSecondsLeft}s para reenviar o código.`
      : (form?.message ?? "");

  return (
    <>
      {/* Header */}
      {step === 1 && (
        <AuthHeader
          icon="icon-[lucide--user-round-plus]"
          title="Criar conta"
          description="Preencha os dados abaixo para criar sua conta e começar a usar."
        />
      )}
      {step === 2 && (
        <AuthHeader
          icon="icon-[lucide--square-asterisk]"
          title="Verifique a conta"
          description={
            email.trim().length > 0
              ? `Para sua segurança, insira o código que recebeu em ${email.trim().toLowerCase()}.`
              : "Para sua segurança, insira o código que recebeu por e-mail."
          }
        />
      )}

      {/* Container */}
      <div className="mt-10 text-base text-zinc-600 dark:text-zinc-200">
        {/* Etapa 1: Inserir os dados para criar a conta */}
        {step === 1 && (
          <>
            <form onSubmit={handleRegister}>
              <fieldset className="grid gap-5" disabled={loading}>
                <div>
                  <Label htmlFor="name" isInvalid={form?.field === "name"}>
                    Nome
                  </Label>
                  <Input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    setValue={setName}
                    autoComplete="name"
                    placeholder="Fulano"
                    required
                    isInvalid={form?.field === "name"}
                    invalidMessage={form?.message}
                  />
                </div>
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
                    isInvalid={form?.field === "email"}
                    invalidMessage={
                      form?.field === "email" ? emailInvalidMessage : undefined
                    }
                  />
                </div>
                <div>
                  <Label
                    htmlFor="password"
                    isInvalid={form?.field === "password"}
                  >
                    Senha
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
                  <Button
                    type="submit"
                    disabled={loading || signUpSecondsLeft > 0}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <span className="icon-[lucide--loader-circle] animate-spin"></span>{" "}
                        Criando conta...
                      </>
                    ) : (
                      <>Criar conta</>
                    )}
                  </Button>
                </div>
                <AuthDivider>ou</AuthDivider>
                <div className="flex w-full flex-col items-center justify-center gap-3">
                  <Button
                    type="button"
                    style="bordered"
                    icon="icon-[logos--google-icon]"
                    className="w-full"
                    onClick={() => {
                      window.location.href = config.getApiUrl(
                        "/api/auth/login-google",
                      );
                    }}
                  >
                    Criar com Google
                  </Button>
                </div>
                <p className="text-center">
                  Tem uma conta? <AuthLink href="/login">Entre</AuthLink>.
                </p>
              </fieldset>
            </form>
          </>
        )}

        {/* Etapa 2: Se o e-mail do usuário não estiver verificado, envia o código OTP para verificar o e-mail */}
        {step === 2 && (
          <>
            <form onSubmit={handleVerifyCode}>
              <fieldset className="grid gap-5" disabled={loading}>
                <input type="hidden" name="email" value={email} />
                <div>
                  <Label htmlFor="code" isInvalid={form?.field === "code"}>
                    Código que recebeu por e-mail
                  </Label>
                  <Pin
                    id="code"
                    name="code"
                    length={6}
                    value={code}
                    setValue={setCode}
                    disabled={loading || mustResendVerificationCode}
                    isInvalid={form?.field === "code"}
                    invalidMessage={
                      form?.field === "code" ? codeInvalidMessage : undefined
                    }
                  />
                </div>
                <div>
                  <Button
                    type="submit"
                    disabled={loading || mustResendVerificationCode}
                    className="w-full"
                  >
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
                {verificationSecondsLeft <= 0 && (
                  <div className="text-center text-sm">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="font-semibold underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                    >
                      Reenviar o código novamente
                    </button>
                  </div>
                )}
                <p className="text-center">
                  <AuthLink
                    onClick={() => {
                      clearFieldError();
                      setCode("");
                      setStep(1);
                    }}
                  >
                    Voltar
                  </AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </>
  );
}
