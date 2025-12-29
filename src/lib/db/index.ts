import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/lib/db/schema'
import { config } from '@/lib/config'

// Inicializar aplicação (validação de config em produção)
import '@/lib/init'

const pool = new Pool({
	connectionString: config.databaseUrl,
	max: 20, // Máximo 20 conexões simultâneas
	idleTimeoutMillis: 30000, // Fechar conexões idle após 30s
	connectionTimeoutMillis: 2000, // Timeout de 2s para obter conexão
})

export const db = drizzle(pool, { schema })
