import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	email_verified: integer().notNull(),
	password: text('password').notNull()
})
export type User = typeof user.$inferSelect

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type Session = typeof session.$inferSelect

export const emailVerificationCode = sqliteTable('email_verification_code', {
	id: text('id').primaryKey(),
	code: text('code'),
	email: text('email').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type EmailVerificationCode = typeof emailVerificationCode.$inferSelect
