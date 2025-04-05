import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) throw new Error('A variaável de ambiente DATABASE_URL não está definida')

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true,
	dialect: 'sqlite'
})
