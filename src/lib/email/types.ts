// Tipos TypeScript para templates de email

export type EmailTemplate = 'otpCode' | 'emailChanged' | 'passwordChanged'

export interface EmailTemplateData {
	otpCode: {
		code: string
		type: 'sign-in' | 'email-verification' | 'forget-password' | 'email-change' | 'setup-password'
	}
	emailChanged: {
		oldEmail: string
		newEmail: string
	}
	passwordChanged: {
		email: string
	}
}

export interface SendEmailTemplateParams<T extends EmailTemplate> {
	to: string
	subject: string
	template: T
	data: EmailTemplateData[T]
}
