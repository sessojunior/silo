# 📧 Configuração SMTP

Documentação sobre configuração de servidor de email SMTP para envio de notificações.

---

## 📋 **ÍNDICE**

1. [Visão Geral](#-visão-geral)
2. [Configuração](#-configuração)
3. [Templates de Email](#-templates-de-email)
4. [Testando](#-testando)
5. [Provedores](#-provedores)
6. [Troubleshooting](#-troubleshooting)

---

## 🎯 **VISÃO GERAL**

O sistema usa **SMTP** para envio de emails institucionais:

- Códigos OTP para login e recuperação de senha
- Notificações de ativação de conta
- Alertas e avisos importantes

---

## ⚙️ **CONFIGURAÇÃO**

### **Variáveis de Ambiente**

```bash
# .env

SMTP_HOST='smtp.exemplo.com'
SMTP_PORT='587'
SMTP_SECURE=false
SMTP_USERNAME='usuario@exemplo.com'
SMTP_PASSWORD='senha-do-email'
```

Observações:

- `SMTP_PORT` é convertido para número (ex.: `'587'` funciona).
- `SMTP_SECURE` deve ser a string `true` para ativar SSL (porta 465). Qualquer outro valor resulta em `false`.

### **Tipos de Conexão**

#### **SMTP com TLS (Porta 587) - Recomendado**

```bash
SMTP_HOST='smtp.gmail.com'
SMTP_PORT='587'
SMTP_SECURE=false
SMTP_USERNAME='seu-email@gmail.com'
SMTP_PASSWORD='senha-do-app'
```

#### **SMTP com SSL (Porta 465)**

```bash
SMTP_HOST='smtp.gmail.com'
SMTP_PORT='465'
SMTP_SECURE=true
SMTP_USERNAME='seu-email@gmail.com'
SMTP_PASSWORD='senha-do-app'
```

### **Arquivo de Configuração**

Arquivo: `src/lib/config.ts`

```typescript
import { config } from '@/lib/config'

const smtpConfig = {
	host: config.email.host,
	port: config.email.port,
	secure: config.email.secure,
	auth: {
		user: config.email.username,
		pass: config.email.password,
	},
}
```

---

## 📧 **TEMPLATES DE EMAIL**

### **Código OTP**

Arquivo: `src/lib/email/templates.ts`

Os templates são gerados por `generateEmailTemplate(...)` e tipados em:

- `src/lib/email/types.ts`

### **Envio de Email**

Arquivo: `src/lib/sendEmail.ts`

```typescript
import { sendEmail } from '@/lib/sendEmail'

await sendEmail({
	to: 'destinatario@inpe.br',
	subject: 'Código de verificação',
	template: 'otpCode',
	data: { code: '123456', type: 'sign-in' },
	text: 'Utilize o código 123456 para fazer login.',
})
```

---

## 🧪 **TESTANDO**

### **Testar Conexão SMTP**

```bash
# Via código Node.js
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'seu-email@gmail.com',
    pass: 'senha-do-app'
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Erro:', error);
  } else {
    console.log('✅ Servidor pronto para enviar emails');
  }
});
"
```

### **Enviar Email de Teste**

```typescript
import { sendEmail } from '@/lib/sendEmail'

await sendEmail({
	to: 'destinatario@inpe.br',
	subject: 'Teste SMTP',
	text: 'Este é um teste.',
})
```

---

## 📦 **PROVEDORES**

### **Gmail**

```bash
# Usar senha de app (não a senha do email)
SMTP_HOST='smtp.gmail.com'
SMTP_PORT='587'
SMTP_SECURE=false
SMTP_USERNAME='seu-email@gmail.com'
SMTP_PASSWORD='senha-do-app'  # Gerar em: https://myaccount.google.com/apppasswords
```

**Como gerar senha de app:**

1. Acesse: <https://myaccount.google.com/apppasswords>
2. Selecione "Email" e "Outro (Nome personalizado)"
3. Digite um nome (ex: "SILO")
4. Copie a senha gerada (16 caracteres)

### **SendGrid**

```bash
SMTP_HOST='smtp.sendgrid.net'
SMTP_PORT='587'
SMTP_SECURE=false
SMTP_USERNAME='apikey'
SMTP_PASSWORD='SG.sua-api-key'
```

### **Mailgun**

```bash
SMTP_HOST='smtp.mailgun.org'
SMTP_PORT='587'
SMTP_SECURE=false
SMTP_USERNAME='postmaster@sandbox.mailgun.org'
SMTP_PASSWORD='sua-senha'
```

---

## 🔧 **TROUBLESHOOTING**

### **Erro: "Authentication failed"**

```bash
# Verificar credenciais
# Gmail: Usar senha de app (não senha do email)
# Outlook: Verificar autenticação de dois fatores
```

### **Erro: "Connection timeout"**

```bash
# Verificar firewall
# Verificar se porta está bloqueada
# Testar no Windows (PowerShell):
Test-NetConnection smtp.gmail.com -Port 587
```

### **Email não chega**

```bash
# Verificar pasta de spam
# Verificar logs do servidor
# Testar com outro provedor
```

### **Rate Limiting**

```bash
# Gmail limita a 99 emails/dia para contas gratuitas
# Considerar usar provedor pago para produção
```

---

## 📊 **TEMPLATES PADRÃO**

Os templates oficiais do projeto ficam em:

- `src/lib/email/templates.ts`
- `src/lib/email/types.ts`

Templates disponíveis (tipados em `EmailTemplate`):

- `otpCode`
- `emailChanged`
- `passwordChanged`

Fallback de texto (quando o cliente não suporta HTML):

- `generateTextFallback(...)`

Em caso de falha ao gerar template, o envio pode fazer fallback para `text` (se fornecido), conforme `src/lib/sendEmail.ts`.

---

**🎯 Implementação em: `src/lib/sendEmail.ts` e `src/lib/email/`**
