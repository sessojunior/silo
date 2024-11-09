import { loadEnvConfig } from "@next/env"

let projectDir
if (typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge") {
	projectDir = process.cwd()
	loadEnvConfig(projectDir)
}
