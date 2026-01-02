import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { deleteUploadFile, getContentTypeFromFilename, isSafeFilename, isUploadKind, readUploadFile } from '@/lib/localUploads'
import { getAuthUser } from '@/lib/auth/token'
import { requireAdmin } from '@/lib/auth/admin'

export const runtime = 'nodejs'

const getAllowedOrigin = (origin: string | null): string | null => {
	if (!origin) return null

	try {
		const requestOrigin = new URL(origin).origin
		if (!config.appUrl) return null
		const appOrigin = new URL(config.appUrl).origin
		return requestOrigin === appOrigin ? requestOrigin : null
	} catch {
		return null
	}
}

const buildFileHeaders = (req: NextRequest): Headers => {
	const headers = new Headers()
	const origin = req.headers.get('origin')
	const allowedOrigin = getAllowedOrigin(origin)

	if (allowedOrigin) {
		headers.set('Access-Control-Allow-Origin', allowedOrigin)
		headers.set('Vary', 'Origin')
	}

	headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS, DELETE')
	headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
	headers.set('Cross-Origin-Resource-Policy', 'same-site')
	return headers
}

export async function OPTIONS(req: NextRequest) {
	return new NextResponse(null, { status: 200, headers: buildFileHeaders(req) })
}

export async function GET(req: NextRequest, context: { params: Promise<{ type: string; filename: string }> }) {
	const { type, filename } = await context.params

	if (!isUploadKind(type)) return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })
	if (!isSafeFilename(filename)) return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })

	const file = await readUploadFile(type, filename)
	if (!file) return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 })

	const headers = buildFileHeaders(req)
	headers.set('Content-Type', getContentTypeFromFilename(filename))
	headers.set('Cache-Control', 'public, max-age=3600')

	const body = new Uint8Array(file)
	return new NextResponse(body, { status: 200, headers })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ type: string; filename: string }> }) {
	const { type, filename } = await context.params

	if (!isUploadKind(type)) return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })
	if (!isSafeFilename(filename)) return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })

	const headers = buildFileHeaders(req)

	const user = await getAuthUser()
	if (!user) {
		return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401, headers })
	}

	const adminCheck = await requireAdmin(user.id)
	if (!adminCheck.success) {
		return NextResponse.json({ field: null, message: adminCheck.error }, { status: 403, headers })
	}

	const ok = await deleteUploadFile(type, filename)
	if (!ok) return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404, headers })

	return NextResponse.json({ success: true, message: 'Arquivo deletado com sucesso' }, { status: 200, headers })
}
