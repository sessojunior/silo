import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
	return NextResponse.json({
		success: true,
		message: 'Aplicação funcionando',
		timestamp: new Date().toISOString(),
	})
}

