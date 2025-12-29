import { NextRequest, NextResponse } from 'next/server'
import { storeImageAsWebp } from '@/lib/localUploads'

export const runtime = 'nodejs'

type UploadResponse = {
	key: string
	name: string
	size: number
	url: string
	id: string
	status: 'uploaded'
	optimized: boolean
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData()
		const candidate = formData.get('file') ?? formData.get('files')
		const file = candidate instanceof File ? candidate : null

		if (!file) return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 })

		const stored = await storeImageAsWebp({
			file,
			kind: 'general',
			requestUrl: request.url,
			options: { mode: 'inside', maxWidth: 1920, maxHeight: 1080, quality: 90 },
		})

		if ('error' in stored) {
			return NextResponse.json({ success: false, error: stored.error }, { status: 400 })
		}

		const response: UploadResponse = {
			key: stored.filename,
			name: stored.originalName,
			size: stored.size,
			url: stored.url,
			id: stored.filename,
			status: 'uploaded',
			optimized: true,
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('❌ [API_UPLOAD] Erro no proxy de upload:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
