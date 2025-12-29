import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

type ProductActivityHistoryEntry = Omit<typeof schema.productActivityHistory.$inferInsert, 'id' | 'createdAt'> & {
	productActivityId: string
	userId: string
	status: string
	description?: string | null
}

export async function recordProductActivityHistory(entry: ProductActivityHistoryEntry) {
	try {
		await db.insert(schema.productActivityHistory).values(entry)
	} catch (error) {
		console.error('❌ [LIB_PRODUCT_ACTIVITY_HISTORY] Erro ao registrar histórico:', { error })
	}
}

export async function recordBulkProductActivityHistory(entries: ProductActivityHistoryEntry[]) {
	try {
		if (entries.length > 0) {
			await db.insert(schema.productActivityHistory).values(entries)
		}
	} catch (error) {
		console.error('❌ [LIB_PRODUCT_ACTIVITY_HISTORY] Erro ao registrar histórico em massa:', { error })
	}
}
