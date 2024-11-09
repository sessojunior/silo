import "@/lib/env"
import { drizzle } from "drizzle-orm/vercel-postgres"
import { sql } from "@vercel/postgres"
import * as schema from "@/drizzle/schema"

export const db = drizzle(sql, { schema })

export const getUsers = async () => {
	const selectResult = await db.select().from(schema.users)
	console.log("Results", selectResult)
	return selectResult
}

export type NewUser = typeof schema.users.$inferInsert

export const insertUser = async (user: NewUser) => {
	return db.insert(schema.users).values(user).returning()
}

export const getUsers2 = async () => {
	const result = await db.query.users.findMany()
	return result
}
