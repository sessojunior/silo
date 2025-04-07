import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'
import { env } from '$env/dynamic/private'

if (!env.DATABASE_URL) throw new Error('A variável de ambiente DATABASE_URL não foi definida.')

const client = createClient({ url: env.DATABASE_URL })

export const db = drizzle(client, { schema })
