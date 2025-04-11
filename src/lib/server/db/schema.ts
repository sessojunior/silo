import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const authUser = sqliteTable('auth_user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified').notNull(),
	password: text('password').notNull()
})
export type AuthUser = typeof authUser.$inferSelect

export const authSession = sqliteTable('auth_session', {
	id: text('id').primaryKey(),
	token: text('token').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type AuthSession = typeof authSession.$inferSelect

export const authCode = sqliteTable('auth_code', {
	id: text('id').primaryKey(),
	code: text('code'),
	email: text('email').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type AuthCode = typeof authCode.$inferSelect

export const authProvider = sqliteTable('auth_provider', {
	id: text('id').primaryKey(),
	googleId: text('google_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id)
})
export type AuthProvider = typeof authProvider.$inferSelect
