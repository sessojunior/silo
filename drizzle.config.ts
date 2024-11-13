import "@/lib/env"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: "./src/drizzle/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_URL! + "?sslmode=require",
	},
	verbose: true,
	strict: true,
})
