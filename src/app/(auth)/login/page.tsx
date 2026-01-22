"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import { isValidCode, isValidEmail } from "@/lib/auth/validate";
import { AUTH_OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/rate-limits";
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
import InputPassword from "@/components/ui/InputPassword";
import Pin from "@/components/ui/Pin";

const loginCooldown = createSessionResendCooldown("login-password");
const emailVerificationCooldown = createSessionResendCooldown("login-email-verification");
const LOGIN_PASSWORD_WAIT_MESSAGE = "Aguarde para tentar novamente.";
const EMAIL_VERIFICATION_WAIT_MESSAGE = "Aguarde para reenviar o código.";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loginSecondsLeft, setLoginSecondsLeft] = useState(0);
  const [emailVerificationSecondsLeft, setEmailVerificationSecondsLeft] =
    useState(0);
  const [mustResendEmailVerificationCode, setMustResendEmailVerificationCode] =
    useState(false);

  useEffect(() => {
    if (step !== 1) return;
    const update = () => {
      const normalizedEmail = email.trim().toLowerCase();
      const unlockAtMs = loginCooldown.readUnlockAtMs(normalizedEmail);
      setLoginSecondsLeft(
        unlockAtMs ? computeSecondsLeftFromUnlockAtMs(unlockAtMs) : 0,
      );
    };
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [email, step]);

  useEffect(() => {
    if (loginSecondsLeft > 0) return;
    if (form.field !== "email") return;
    if (form.message !== LOGIN_PASSWORD_WAIT_MESSAGE) return;
    clearFieldError();
  }, [clearFieldError, form.field, form.message, loginSecondsLeft]);

  useEffect(() => {
    if (step !== 2) return;
    const update = () => {
      const normalizedEmail = email.trim().toLowerCase();
      const unlockAtMs = emailVerificationCooldown.readUnlockAtMs(normalizedEmail);
      setEmailVerificationSecondsLeft(
        unlockAtMs ? computeSecondsLeftFromUnlockAtMs(unlockAtMs) : 0,
      );
    };
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [email, step]);

  useEffect(() => {
    if (emailVerificationSecondsLeft > 0) return;
    if (form.field !== "code") return;
    if (form.message !== EMAIL_VERIFICATION_WAIT_MESSAGE) return;
    clearFieldError();
  }, [clearFieldError, emailVerificationSecondsLeft, form.field, form.message]);

  useEffect(() => {
    if (step !== 2) setMustResendEmailVerificationCode(false);
  }, [step]);

  const handleResendVerificationCode = async () => {
    setCode("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      setStep(1);
      return;
    }

    if (emailVerificationSecondsLeft > 0) return;

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(
          config.getApiUrl("/api/auth/sign-up/email/send-otp"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, resend: true }),
          },
        );

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
            emailVerificationCooldown.writeUnlockAtMsFromSeconds(
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
        emailVerificationCooldown.writeUnlockAtMsFromSeconds(
          normalizedEmail,
          cooldownSeconds ?? AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        );
        setMustResendEmailVerificationCode(false);
        toast({ type: "info", title: message });
      } catch (err) {
        console.error("❌ [PAGE_LOGIN] Erro ao reenviar código:", { error: err });
        toast({ type: "error", title: "Erro ao reenviar código." });
        setFieldError(null, "Erro ao reenviar código.");
      }
    });
  };

  // Etapa 1: Fazer login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setFieldError("email", "Digite um e-mail válido.");
      return;
    }
    if (loginSecondsLeft > 0) {
      setFieldError("email", LOGIN_PASSWORD_WAIT_MESSAGE);
      toast({
        type: "info",
        title: LOGIN_PASSWORD_WAIT_MESSAGE,
        description: `Tente novamente em ${loginSecondsLeft}s.`,
      });
      return;
    }
    if (!password) {
      setFieldError("password", "Digite sua senha.");
      return;
    }

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(config.getApiUrl("/api/auth/login/password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        const data = (await res.json()) as ApiResponse<unknown>;
        const message = data.message || data.error || "Erro ao entrar.";

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
            loginCooldown.writeUnlockAtMsFromSeconds(normalizedEmail, retryAfter);
            setFieldError("email", LOGIN_PASSWORD_WAIT_MESSAGE);
            toast({
              type: "info",
              title: message,
              description: `Tente novamente em ${retryAfter}s.`,
            });
            return;
          }

          const isInactiveUser =
            res.status === 403 && message.toLowerCase().includes("usuário inativo");

          if (isInactiveUser) {
            const otpRes = await fetch(
              config.getApiUrl("/api/auth/sign-up/email/send-otp"),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail }),
              },
            );

            const otpData = (await otpRes.json()) as ApiResponse<unknown>;
            const otpMessage =
              otpData.message || otpData.error || "Erro ao enviar código.";

            const otpRetryAfterSeconds = (() => {
              if (typeof otpData.data !== "object" || otpData.data === null)
                return null;
              if (!("retryAfterSeconds" in otpData.data)) return null;
              const raw = (otpData.data as { retryAfterSeconds?: unknown })
                .retryAfterSeconds;
              if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
                return null;
              return Math.ceil(raw);
            })();

            const otpRetryAfterFromHeader = (() => {
              const raw = otpRes.headers.get("Retry-After");
              if (!raw) return null;
              const parsed = Number(raw);
              if (!Number.isFinite(parsed) || parsed <= 0) return null;
              return Math.ceil(parsed);
            })();

            if (!otpRes.ok) {
              const retryAfter = otpRetryAfterSeconds ?? otpRetryAfterFromHeader;
              if (otpRes.status === 429 && retryAfter) {
                emailVerificationCooldown.writeUnlockAtMsFromSeconds(
                  normalizedEmail,
                  retryAfter,
                );
                setFieldError("email", EMAIL_VERIFICATION_WAIT_MESSAGE);
                toast({
                  type: "info",
                  title: otpMessage,
                  description: `Tente novamente em ${retryAfter}s.`,
                });
                return;
              }

              setFieldError(otpData.field || "email", otpMessage);
              toast({ type: "error", title: otpMessage });
              return;
            }

            const otpCooldownSeconds = (() => {
              if (typeof otpData.data !== "object" || otpData.data === null)
                return null;
              if (!("cooldownSeconds" in otpData.data)) return null;
              const raw = (otpData.data as { cooldownSeconds?: unknown })
                .cooldownSeconds;
              if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
                return null;
              return Math.ceil(raw);
            })();

            toast({
              type: "info",
              title: "Agora só falta verificar seu e-mail.",
            });
            setCode("");
            emailVerificationCooldown.writeUnlockAtMsFromSeconds(
              normalizedEmail,
              otpCooldownSeconds ?? AUTH_OTP_RESEND_COOLDOWN_SECONDS,
            );
            setMustResendEmailVerificationCode(false);
            setStep(2);
            return;
          }

          setFieldError(data.field || null, message);
          toast({
            type: "error",
            title: message,
          });
          return;
        }

        router.push(postLoginRedirectPath);
      } catch (err) {
        console.error("❌ [PAGE_LOGIN] Erro inesperado:", { error: err });
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
    if (mustResendEmailVerificationCode) return;

    await withLoading(async () => {
      clearFieldError();

      try {
        const res = await fetch(
          config.getApiUrl("/api/auth/sign-up/email/verify-otp"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, code }),
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
            emailVerificationCooldown.writeUnlockAtMsFromSeconds(
              normalizedEmail,
              retryAfter,
            );
            setMustResendEmailVerificationCode(true);
            setCode("");
            setFieldError("code", EMAIL_VERIFICATION_WAIT_MESSAGE);
            toast({
              type: "info",
              title: "Aguarde para reenviar o código.",
              description: `Clique em "Reenviar o código novamente" para receber um novo código. Tente novamente em ${retryAfter}s.`,
              duration: 60,
            });
            return;
          }

          setFieldError(data.field || "code", message);
          toast({ type: "error", title: message });
          return;
        }

        const signInRes = await fetch(config.getApiUrl("/api/auth/login/password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        const signInData = (await signInRes.json()) as ApiResponse<unknown>;
        const signInMessage = signInData.message || signInData.error || "Erro ao entrar.";

        const retryAfterSeconds = (() => {
          if (typeof signInData.data !== "object" || signInData.data === null)
            return null;
          if (!("retryAfterSeconds" in signInData.data)) return null;
          const raw = (signInData.data as { retryAfterSeconds?: unknown })
            .retryAfterSeconds;
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
            return null;
          return Math.ceil(raw);
        })();

        const retryAfterFromHeader = (() => {
          const raw = signInRes.headers.get("Retry-After");
          if (!raw) return null;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed <= 0) return null;
          return Math.ceil(parsed);
        })();

        if (!signInRes.ok) {
          const retryAfter = retryAfterSeconds ?? retryAfterFromHeader;
          if (signInRes.status === 429 && retryAfter) {
            loginCooldown.writeUnlockAtMsFromSeconds(normalizedEmail, retryAfter);
            setStep(1);
            setFieldError("email", LOGIN_PASSWORD_WAIT_MESSAGE);
            toast({
              type: "info",
              title: signInMessage,
              description: `Tente novamente em ${retryAfter}s.`,
            });
            return;
          }

          setFieldError(signInData.field || null, signInMessage);
          toast({
            type: "error",
            title: signInMessage,
          });
          return;
        }

        toast({
          type: "success",
          title: "Conta verificada com sucesso.",
        });

        router.push(postLoginRedirectPath);
      } catch (err) {
        console.error("❌ [PAGE_LOGIN] Erro ao verificar o código:", {
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

  const emailInvalidMessage =
    loginSecondsLeft > 0
      ? `Aguarde ${loginSecondsLeft} segundos para tentar novamente.`
      : (form?.message ?? "");

  const codeInvalidMessage =
    form?.field === "code" &&
    form?.message === EMAIL_VERIFICATION_WAIT_MESSAGE &&
    emailVerificationSecondsLeft > 0
      ? `Aguarde ${emailVerificationSecondsLeft}s para reenviar o código.`
      : (form?.message ?? "");

  return (
    <>
      {/* Header */}
      {step === 1 && (
        <AuthHeader
          icon="icon-[lucide--log-in]"
          title="Entrar"
          description="Entre para começar a usar."
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
        {/* Etapa 1: Inserir o e-mail e a senha para fazer login */}
        {step === 1 && (
          <>
            <form onSubmit={handleLogin}>
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
                    isInvalid={form?.field === "email" || loginSecondsLeft > 0}
                    invalidMessage={emailInvalidMessage}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="password"
                    isInvalid={form?.field === "password"}
                  >
                    Senha
                  </Label>
                  <InputPassword
                    id="password"
                    name="password"
                    value={password}
                    setValue={setPassword}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    minLength={6}
                    maxLength={160}
                    required
                    isInvalid={form?.field === "password"}
                    invalidMessage={form?.message}
                  />
                </div>
                <p className="text-end">
                  <AuthLink href="/forget-password">
                    Redefinir ou esqueceu a senha?
                  </AuthLink>
                </p>
                <div>
                  <Button
                    type="submit"
                    disabled={loading || loginSecondsLeft > 0}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <span className="icon-[lucide--loader-circle] animate-spin"></span>{" "}
                        Entrando...
                      </>
                    ) : (
                      <>Entrar</>
                    )}
                  </Button>
                </div>
                <AuthDivider>ou</AuthDivider>
                <div className="flex w-full flex-col items-center justify-center gap-3">
                  <Button
                    href="/login-email"
                    type="button"
                    style="bordered"
                    icon="icon-[lucide--log-in]"
                    className="w-full"
                  >
                    Entrar só com e-mail
                  </Button>
                  <Button
                    type="button"
                    style="bordered"
                    icon="icon-[logos--google-icon]"
                    className="w-full"
                    onClick={() => {
                      router.push("/login-google");
                    }}
                  >
                    Entrar com Google
                  </Button>
                </div>
                <p className="text-center">
                  Não tem conta?{" "}
                  <AuthLink href="/register">Cadastre-se</AuthLink>.
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
                    disabled={loading || mustResendEmailVerificationCode}
                    isInvalid={form?.field === "code"}
                    invalidMessage={
                      form?.field === "code" ? codeInvalidMessage : undefined
                    }
                  />
                </div>
                <div>
                  <Button
                    type="submit"
                    disabled={loading || mustResendEmailVerificationCode}
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
                {emailVerificationSecondsLeft <= 0 && (
                  <div className="text-center text-sm">
                    <button
                      type="button"
                      onClick={handleResendVerificationCode}
                      disabled={loading}
                      className="font-semibold underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                    >
                      Reenviar o código novamente
                    </button>
                  </div>
                )}
                <p className="text-center">
                  <AuthLink href="/login">Voltar</AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </>
  );
}
