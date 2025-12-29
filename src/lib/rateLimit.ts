import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

// Verifica se um IP ou email ultrapassaram o limite de envio para um tipo específico

// Verifica se a taxa de envio de e-mails para um IP ou e-mail foi excedida
// Retorna true se estiver bloqueado, false se estiver permitido
// - email - E-mail de destino
// - ip - IP do usuário que fez a requisição
// - route - Tipo da rota (ex: 'sign-in', 'email-verification', 'forget-password')
// - limit - Número máximo de tentativas (padrão: 3 tentativas)
// - windowInSeconds - Janela de tempo permitida em segundos (padrão: 60 segundos)
export async function isRateLimited({ email, ip, route, limit = 3, windowInSeconds = 60 }: { email: string; ip: string; route: string; limit?: number; windowInSeconds?: number }): Promise<boolean> {
	const now = new Date()
	const windowStart = new Date(now.getTime() - windowInSeconds * 1000)

	// Primeiro limpa registros antigos (com mais de 1 hora) para manutenção automática
	await cleanRateLimitRecords()

	// Busca registro que combine email, IP e tipo da rota
	const existing = await db.query.rateLimit.findFirst({
		where: and(eq(rateLimit.email, email), eq(rateLimit.ip, ip), eq(rateLimit.route, route)),
	})

	// Nenhum registro: não houve tentativas anteriores, está liberado
	if (!existing) return false

	// Registro antigo (fora da janela): libera e reseta depois
	if (existing.lastRequest < windowStart) return false

	// Dentro da janela e acima do limite permitido
	return existing.count >= limit
}

// Atualiza ou cria o registro de tentativa de envio
export async function recordRateLimit({ email, ip, route }: { email: string; ip: string; route: string }): Promise<void> {
	// Usar UPSERT para evitar race condition
	// PostgreSQL: ON CONFLICT DO UPDATE
	const resetWindow = new Date(new Date().getTime() - 60 * 1000)
	
	await db.insert(rateLimit).values({
		id: randomUUID(),
		route,
		email,
		ip,
		count: 1,
		lastRequest: new Date(),
	}).onConflictDoUpdate({
		target: [rateLimit.email, rateLimit.ip, rateLimit.route],
		set: {
			count: sql`CASE 
				WHEN ${rateLimit.lastRequest} < ${resetWindow} THEN 1 
				ELSE ${rateLimit.count} + 1 
			END`,
			lastRequest: new Date(),
		},
	})
}

// Função auxiliar que remove registros antigos do banco (ex: mais de 60 minutos)
// Usado para limpar tentativas antigas e manter o banco leve
async function cleanRateLimitRecords(olderThanMinutes = 60): Promise<void> {
	const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000)

	// Remove registros antigos
	await db.delete(rateLimit).where(lt(rateLimit.lastRequest, threshold))
}
