import "@/lib/env"
import { drizzle } from "drizzle-orm/vercel-postgres"
import { sql } from "@vercel/postgres"
import { UsersTable } from "@/drizzle/schema"
import * as schema from "@/drizzle/schema"

export const db = drizzle(sql, { schema })

export const getUsers = async () => {
	const selectResult = await db.select().from(UsersTable)
	console.log("Results", selectResult)
	return selectResult
}

export type NewUser = typeof UsersTable.$inferInsert

export const insertUser = async (user: NewUser) => {
	return db.insert(UsersTable).values(user).returning()
}

export const getUsers2 = async () => {
	const result = await db.query.UsersTable.findMany()
	return result
}
