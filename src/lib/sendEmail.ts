import nodemailer from 'nodemailer'
import { config } from '@/lib/config'
import { sendEmailTemplate } from './email/sendEmailTemplate'
import { EmailTemplate, EmailTemplateData } from './email/types'

// BACKUP DA FUNÇÃO ORIGINAL (para rollback seguro)
async function sendEmailOriginal({ to, subject, text }: { to: string; subject: string; text: string }): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Configuração do SMTP
	const transporter = nodemailer.createTransport({
		host: config.email.host,
		port: config.email.port,
		secure: config.email.secure,
		auth: {
			user: config.email.username,
			pass: config.email.password,
		},
	})

	// Verifica se a conexão com o SMTP está funcionando
	try {
		await transporter.verify()
	} catch (error) {
		console.error('❌ [LIB_SEND_EMAIL] Erro de conexão SMTP:', { error })
		return { error: { code: 'SEND_EMAIL_SMTP_ERROR', message: 'Erro de conexão SMTP' } }
	}

	// Configuração do e-mail
	const mailOptions = {
		from: config.email.from,
		to,
		subject,
		text,
	}

	try {
		await transporter.sendMail(mailOptions)
		return { success: true }
	} catch (err) {
		console.error('❌ [LIB_SEND_EMAIL] Erro ao enviar o e-mail:', { to, error: err })
		return { error: err instanceof Error ? { code: err.name, message: err.message } : { code: 'SEND_EMAIL_UNKNOWN_ERROR', message: 'Erro desconhecido' } }
	}
}

// FUNÇÃO HÍBRIDA COM SUPORTE A TEMPLATES E FALLBACK AUTOMÁTICO
export async function sendEmail(params: {
	to: string
	subject: string
	text?: string
	template?: EmailTemplate
	data?: EmailTemplateData[EmailTemplate]
}): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	const { to, subject, text, template, data } = params

	// Se template e data fornecidos, usar nova implementação com templates
	if (template && data) {
		try {
			return await sendEmailTemplate({ to, subject, template, data })
		} catch (error) {
			console.warn('⚠️ [LIB_SEND_EMAIL] Erro no template, usando fallback para texto simples:', { error })
			// FALLBACK: Se template falhar, usar implementação original
			if (text) {
				return await sendEmailOriginal({ to, subject, text })
			} else {
				return { error: { code: 'TEMPLATE_FALLBACK_ERROR', message: 'Template falhou e não há texto de fallback' } }
			}
		}
	}

	// Se apenas texto fornecido, usar implementação original
	if (text) {
		return await sendEmailOriginal({ to, subject, text })
	}

	// Se nenhum parâmetro válido fornecido
	return { error: { code: 'INVALID_PARAMS', message: 'Forneça text ou template+data' } }
}
