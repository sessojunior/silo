"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { translateAuthError } from "@/lib/auth/i18n";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import {
  isValidCode,
  isValidEmail,
  isValidName,
  isValidPassword,
} from "@/lib/auth/validate";

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

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const { form, loading, setFieldError, clearFieldError, withLoading } =
    useAuthFormState();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

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

    await withLoading(async () => {
      clearFieldError();

      try {
        const { error } = await authClient.signUp.email({
          name: normalizedName,
          email: formatEmail,
          password,
        });

        if (error) {
          const errorMessage = translateAuthError(error, "Erro ao criar conta.");
          setFieldError(null, errorMessage);
          toast({
            type: "error",
            title: errorMessage,
          });
          return;
        }

        const { error: otpError } =
          await authClient.emailOtp.sendVerificationOtp({
            email: formatEmail,
            type: "email-verification",
          });

        if (otpError) {
          const otpErrorMessage = translateAuthError(
            otpError,
            "Erro ao enviar código.",
          );
          setFieldError("email", otpErrorMessage);
          toast({
            type: "error",
            title: otpErrorMessage,
          });
          return;
        }

        toast({
          type: "success",
          title: "Conta criada com sucesso. Verifique seu e-mail.",
        });
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

    await withLoading(async () => {
      clearFieldError();

      try {
        const { error } = await authClient.emailOtp.checkVerificationOtp({
          email: formatEmail,
          otp: code,
          type: "email-verification",
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

        const { error: signInError } = await authClient.signIn.email({
          email: formatEmail,
          password,
        });

        if (signInError) {
          const errorMessage = translateAuthError(
            signInError,
            "Erro ao entrar. Verifique suas credenciais.",
          );
          setFieldError(null, errorMessage);
          toast({
            type: "error",
            title: errorMessage,
          });
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
          description="Precisamos verificar seu e-mail, insira o código que recebeu por e-mail."
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
                    invalidMessage={form?.message}
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
                  <Button type="submit" disabled={loading} className="w-full">
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
                      router.push("/login-google");
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
                  <AuthLink onClick={() => setStep(1)}>Voltar</AuthLink>
                </p>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </>
  );
}
