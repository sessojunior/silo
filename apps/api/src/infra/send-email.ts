import nodemailer from "nodemailer";
import { config } from "@silo/engine/config";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
  const { to, subject, text } = params;

  const emailConfig = config.email;
  if (!emailConfig.from) {
    return { error: { code: "SEND_EMAIL_MISSING_FROM", message: "Configuração de remetente de e-mail não encontrada" } };
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.username ? {
      user: emailConfig.username,
      pass: emailConfig.password,
    } : undefined,
  });

  try {
    await transporter.verify();
  } catch (error) {
    console.error("❌ [SEND_EMAIL] Erro de conexão SMTP:", { error });
    return { error: { code: "SEND_EMAIL_SMTP_ERROR", message: "Erro de conexão SMTP" } };
  }

  try {
    const info = await transporter.sendMail({ from: emailConfig.from, to, subject, text });
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    if (rejected.length > 0) {
      return { error: { code: "SEND_EMAIL_REJECTED", message: "O servidor SMTP rejeitou o destinatário" } };
    }
    if (accepted.length === 0) {
      return { error: { code: "SEND_EMAIL_NOT_ACCEPTED", message: "O servidor SMTP não aceitou o destinatário" } };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ [SEND_EMAIL] Erro ao enviar e-mail:", { to, error: err });
    return {
      error: err instanceof Error
        ? { code: err.name, message: err.message }
        : { code: "SEND_EMAIL_UNKNOWN_ERROR", message: "Erro desconhecido" },
    };
  }
}
