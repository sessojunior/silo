import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const authUser = sqliteTable('auth_user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified').notNull(),
	password: text('password').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
export type AuthUser = typeof authUser.$inferSelect

export const authSession = sqliteTable('auth_session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	token: text('token').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type AuthSession = typeof authSession.$inferSelect

export const authCode = sqliteTable('auth_code', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	code: text('code'),
	email: text('email').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
})
export type AuthCode = typeof authCode.$inferSelect

export const authProvider = sqliteTable('auth_provider', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	googleId: text('google_id').notNull()
})
export type AuthProvider = typeof authProvider.$inferSelect

export const userProfile = sqliteTable('user_profile', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	genre: text('genre').notNull(),
	phone: text('phone').notNull(),
	role: text('role').notNull(),
	team: text('team').notNull(),
	company: text('company').notNull(),
	location: text('location').notNull()
})
export type UserProfile = typeof userProfile.$inferSelect

export const userPreferences = sqliteTable('user_preferences', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUser.id),
	theme: text('theme').notNull(),
	notifyUpdates: integer({ mode: 'boolean' }).notNull(),
	sendNewsletters: integer({ mode: 'boolean' }).notNull()
})
export type UserPreferences = typeof userPreferences.$inferSelect
