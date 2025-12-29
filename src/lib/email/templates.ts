// Templates de email modernos e clean para o sistema SILO

import { EmailTemplate, EmailTemplateData } from './types'
import { config } from '@/lib/config'

// Template base com layout CPTEC/INPE
const baseTemplate = (content: string, subject: string): string => `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#ffffff;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:auto;border-radius:12px;overflow:hidden;">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;padding:24px 32px;border-radius:12px 12px 0 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="left" style="font-size:28px;font-weight:700;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.1);">
                SILO
              </td>
              <td align="right" style="font-size:13px;opacity:0.95;font-weight:400;letter-spacing:0.5px;">
                CPTEC/INPE
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Content -->
      <tr>
        <td style="padding:40px 30px;color:#111827;line-height:1.6;">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f1f5f9;padding:24px 32px;border:1px solid #e7e7e7;border-radius:0 0 12px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="left" style="font-size:13px;opacity:0.95;font-weight:400;letter-spacing:0.5px;color:#64748b;">
                CPTEC/INPE
              </td>
              <td align="right" style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#64748b;">
                SILO
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

// Template para códigos OTP
const otpCodeTemplate = (data: EmailTemplateData['otpCode']): string => {
	const { code, type } = data
	
	const getTypeText = (type: string): string => {
		switch (type) {
			case 'sign-in': return 'para fazer login'
			case 'email-verification': return 'para verificar seu e-mail'
			case 'forget-password': return 'para recuperar sua senha'
			case 'setup-password': return 'para definir sua senha inicial'
			case 'email-change': return 'para alterar seu e-mail'
			default: return 'a seguir'
		}
	}
	
	const expirationMinutes = type === 'setup-password' ? 30 : 10
	
	// 🆕 URL base do site usando config centralizado
	const baseUrl = config.appUrl || 'http://localhost:3000'
	const setupPasswordUrl = `${baseUrl}/setup-password`
	
	// Botão/link para setup-password
	const setupPasswordButton = type === 'setup-password' ? `
		<div style="margin:15px 0;">
			<a href="${setupPasswordUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;text-align:center;">
				Definir minha senha
			</a>
		</div>
		<p style="color:#64748b;margin:0;">
			Ou copie e cole este link no seu navegador:<br>
			<a href="${setupPasswordUrl}" style="color:#2563eb;text-decoration:underline;">${setupPasswordUrl}</a>
		</p>
	` : ''
	
	return `
		<h2 style="color:#1e293b;margin:0 0 20px;font-size:20px;">Código de Verificação</h2>
		<p style="color:#64748b;margin:0;line-height:1.6;">
			Utilize o seguinte código de verificação ${getTypeText(type)}:
		</p>
		<div style="background:#f1f5f9;border:2px solid #e2e8f0;border-radius:8px;padding:5px;text-align:center;margin:20px 0;">
			<span style="font-size:32px;font-weight:700;color:#2563eb;letter-spacing:4px;">${code}</span>
		</div>
		${setupPasswordButton}
		<p style="color:#64748b;margin:20px 0 0;font-size:14px;">
			Este código expira em ${expirationMinutes} minutos.<br>
			Se você não solicitou isso, ignore este email.
		</p>
	`
}

// Template para confirmação de alteração de email
const emailChangedTemplate = (data: EmailTemplateData['emailChanged']): string => {
	const { oldEmail, newEmail } = data
	
	return `
		<h2 style="color:#1e293b;margin:0 0 20px;font-size:20px;">Email Alterado</h2>
		<p style="color:#64748b;margin:0 0 20px;line-height:1.6;">
			Seu email foi alterado com sucesso de <strong>${oldEmail}</strong> para <strong>${newEmail}</strong>.
		</p>
		<p style="color:#64748b;margin:0;font-size:14px;">
			Se você não fez esta alteração, entre em contato conosco imediatamente.
		</p>
	`
}

// Template para confirmação de alteração de senha
const passwordChangedTemplate = (data: EmailTemplateData['passwordChanged']): string => {
	const { email } = data
	
	return `
		<h2 style="color:#1e293b;margin:0 0 20px;font-size:20px;">Senha Alterada</h2>
		<p style="color:#64748b;margin:0 0 20px;line-height:1.6;">
			Sua senha foi alterada com sucesso para o email <strong>${email}</strong>.
		</p>
		<p style="color:#64748b;margin:0;font-size:14px;">
			Se você não fez esta alteração, entre em contato conosco imediatamente.
		</p>
	`
}

// Função principal para gerar templates
export function generateEmailTemplate<T extends EmailTemplate>(
	template: T,
	data: EmailTemplateData[T],
	subject: string
): string {
	let content: string
	
	switch (template) {
		case 'otpCode':
			content = otpCodeTemplate(data as EmailTemplateData['otpCode'])
			break
		case 'emailChanged':
			content = emailChangedTemplate(data as EmailTemplateData['emailChanged'])
			break
		case 'passwordChanged':
			content = passwordChangedTemplate(data as EmailTemplateData['passwordChanged'])
			break
		default:
			throw new Error(`Template não encontrado: ${template}`)
	}
	
	return baseTemplate(content, subject)
}

// Função para gerar fallback de texto simples
export function generateTextFallback<T extends EmailTemplate>(
	template: T,
	data: EmailTemplateData[T]
): string {
	switch (template) {
		case 'otpCode': {
			const { code, type } = data as EmailTemplateData['otpCode']
			const typeText = type === 'sign-in' ? 'para fazer login' : 
				type === 'email-verification' ? 'para verificar seu e-mail' :
				type === 'forget-password' ? 'para recuperar sua senha' :
				type === 'email-change' ? 'para alterar seu e-mail' : 'a seguir'
			return `Utilize o seguinte código de verificação ${typeText}: ${code}`
		}
		case 'emailChanged': {
			const { oldEmail, newEmail } = data as EmailTemplateData['emailChanged']
			return `Seu email foi alterado de ${oldEmail} para ${newEmail}. Se você não fez esta alteração, entre em contato conosco.`
		}
		case 'passwordChanged': {
			const { email } = data as EmailTemplateData['passwordChanged']
			return `Sua senha foi alterada para o email ${email}. Se você não fez esta alteração, entre em contato conosco.`
		}
		default:
			throw new Error(`Template não encontrado: ${template}`)
	}
}
