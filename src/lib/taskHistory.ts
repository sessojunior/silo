import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

interface TaskHistoryEntry {
	taskId: string
	userId: string
	action: 'status_change' | 'created' | 'updated' | 'deleted'
	fromStatus?: string | null
	toStatus: string
	fromSort?: number | null
	toSort: number | null
	details?: Record<string, unknown>
}

/**
 * Registra uma entrada no histórico de movimentação da tarefa
 */
export async function recordTaskHistory(entry: TaskHistoryEntry): Promise<void> {
	try {
		await db.insert(schema.projectTaskHistory).values({
			taskId: entry.taskId,
			userId: entry.userId,
			action: entry.action,
			fromStatus: entry.fromStatus,
			toStatus: entry.toStatus,
			fromSort: entry.fromSort,
			toSort: entry.toSort,
			details: entry.details || null,
		})

	} catch (error) {
		console.error('❌ [LIB_TASK_HISTORY] Erro ao registrar histórico da tarefa:', { error })
		// Não falhar a operação principal se o histórico falhar
	}
}

/**
 * Registra múltiplas entradas de histórico em lote (para drag & drop)
 */
export async function recordBulkTaskHistory(entries: TaskHistoryEntry[]): Promise<void> {
	if (entries.length === 0) return

	try {
		const historyEntries = entries.map((entry) => ({
			taskId: entry.taskId,
			userId: entry.userId,
			action: entry.action,
			fromStatus: entry.fromStatus,
			toStatus: entry.toStatus,
			fromSort: entry.fromSort,
			toSort: entry.toSort,
			details: entry.details || null,
		}))

		await db.insert(schema.projectTaskHistory).values(historyEntries)
	} catch (error) {
		console.error('❌ [LIB_TASK_HISTORY] Erro ao registrar histórico em lote:', { error })
		// Não falhar a operação principal se o histórico falhar
	}
}

/**
 * Utilitário para mapear status para nomes amigáveis
 */
export const STATUS_NAMES: Record<string, string> = {
	todo: 'A fazer',
	in_progress: 'Em progresso',
	blocked: 'Bloqueado',
	review: 'Em revisão',
	done: 'Concluído',
}

/**
 * Utilitário para mapear ações para nomes amigáveis
 */
export const ACTION_NAMES: Record<string, string> = {
	created: 'Criou',
	status_change: 'Moveu',
	updated: 'Editou',
	deleted: 'Excluiu',
}
