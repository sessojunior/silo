// Função independente para envio de emails com templates

import nodemailer from "nodemailer";
import { config } from "@/lib/config";
import type { EmailTemplate, SendEmailTemplateParams } from "@/lib/email/types";
import {
  generateEmailTemplate,
  generateTextFallback,
} from "@/lib/email/templates";

// Função independente para envio de emails com templates
export async function sendEmailTemplate<T extends EmailTemplate>(
  params: SendEmailTemplateParams<T>,
): Promise<
  { success: boolean } | { error: { code: string; message: string } }
> {
  const { to, subject, template, data } = params;

  if (!config.email.from) {
    return {
      error: {
        code: "SEND_EMAIL_MISSING_FROM",
        message: "Configuração de remetente de e-mail não encontrada",
      },
    };
  }

  // Configuração do SMTP (mesma da função original)
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.username,
      pass: config.email.password,
    },
  });

  // Verifica se a conexão com o SMTP está funcionando
  try {
    await transporter.verify();
  } catch (error) {
    console.error("❌ [LIB_SEND_EMAIL_TEMPLATE] Erro de conexão SMTP:", {
      error,
    });
    return {
      error: { code: "SEND_EMAIL_SMTP_ERROR", message: "Erro de conexão SMTP" },
    };
  }

  // Gera HTML do template
  let html: string;
  let textFallback: string;

  try {
    html = generateEmailTemplate(template, data, subject);
    textFallback = generateTextFallback(template, data);
  } catch (error) {
    console.error("❌ [LIB_SEND_EMAIL_TEMPLATE] Erro ao gerar template:", {
      error,
    });
    return {
      error: {
        code: "TEMPLATE_ERROR",
        message: "Erro ao gerar template de email",
      },
    };
  }

  // Configuração do e-mail com HTML e fallback de texto
  const mailOptions = {
    from: config.email.from,
    to,
    subject,
    html,
    text: textFallback, // Fallback para clientes que não suportam HTML
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    const accepted = (info as { accepted?: unknown }).accepted;
    const rejected = (info as { rejected?: unknown }).rejected;

    const acceptedList = Array.isArray(accepted)
      ? accepted.map((value) => String(value))
      : [];
    const rejectedList = Array.isArray(rejected)
      ? rejected.map((value) => String(value))
      : [];

    if (rejectedList.length > 0) {
      return {
        error: {
          code: "SEND_EMAIL_REJECTED",
          message: "O servidor SMTP rejeitou o destinatário",
        },
      };
    }

    if (acceptedList.length === 0) {
      return {
        error: {
          code: "SEND_EMAIL_NOT_ACCEPTED",
          message: "O servidor SMTP não aceitou o destinatário",
        },
      };
    }

    return { success: true };
  } catch (err) {
    console.error(
      "❌ [LIB_SEND_EMAIL_TEMPLATE] Erro ao enviar o e-mail com template:",
      { to, error: err },
    );
    return {
      error:
        err instanceof Error
          ? { code: err.name, message: err.message }
          : { code: "SEND_EMAIL_UNKNOWN_ERROR", message: "Erro desconhecido" },
    };
  }
}
