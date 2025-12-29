import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { deleteUploadFile, getContentTypeFromFilename, isSafeFilename, isUploadKind, readUploadFile } from '@/lib/localUploads'

export const runtime = 'nodejs'

const buildFileHeaders = (req: NextRequest): Headers => {
	const headers = new Headers()
	const origin = req.headers.get('origin')
	const allowedOrigin = origin || config.appUrl || '*'

	if (allowedOrigin !== '*') {
		headers.set('Access-Control-Allow-Origin', allowedOrigin)
		headers.set('Access-Control-Allow-Credentials', 'true')
		headers.set('Vary', 'Origin')
	}

	headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS, DELETE')
	headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
	headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
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

	const ok = await deleteUploadFile(type, filename)
	if (!ok) return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 })

	return NextResponse.json({ success: true, message: 'Arquivo deletado com sucesso' }, { status: 200 })
}
