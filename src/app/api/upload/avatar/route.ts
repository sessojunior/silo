import { NextRequest, NextResponse } from 'next/server'
import { storeImageAsWebp } from '@/lib/localUploads'

export const runtime = 'nodejs'

type SingleUploadData = {
	key: string
	name: string
	size: number
	url: string
	id: string
	status: 'uploaded'
	optimized: boolean
}

type SingleUploadResponse =
	| { success: true; message: string; data: SingleUploadData }
	| { success: false; error: string }

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData()
		const candidate = formData.get('file')
		const file = candidate instanceof File ? candidate : null

		if (!file) {
			const response: SingleUploadResponse = { success: false, error: 'Nenhum arquivo enviado' }
			return NextResponse.json(response, { status: 400 })
		}

		const stored = await storeImageAsWebp({
			file,
			kind: 'avatars',
			requestUrl: request.url,
			options: { mode: 'square', size: 80, quality: 85 },
		})

		if ('error' in stored) {
			const response: SingleUploadResponse = { success: false, error: stored.error }
			return NextResponse.json(response, { status: 400 })
		}

		const response: SingleUploadResponse = {
			success: true,
			message: 'Upload de avatar concluído com sucesso!',
			data: {
				key: stored.filename,
				name: stored.originalName,
				size: stored.size,
				url: stored.url,
				id: stored.filename,
				status: 'uploaded',
				optimized: true,
			},
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('❌ [API_UPLOAD_AVATAR] Erro no proxy de upload de avatar:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
