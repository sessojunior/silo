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

type MultiUploadResponse =
	| { success: true; message: string; data: UploadResponse[] }
	| { success: false; error: string }

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData()
		const all = formData.getAll('files')
		const files = all.filter((item): item is File => item instanceof File)

		if (files.length === 0) {
			const response: MultiUploadResponse = { success: false, error: 'Nenhum arquivo enviado' }
			return NextResponse.json(response, { status: 400 })
		}

		if (files.length > 3) {
			const response: MultiUploadResponse = { success: false, error: 'Máximo de 3 arquivos por upload.' }
			return NextResponse.json(response, { status: 400 })
		}

		const uploaded: UploadResponse[] = []
		for (const file of files) {
			const stored = await storeImageAsWebp({
				file,
				kind: 'problems',
				requestUrl: request.url,
				options: { mode: 'inside', maxWidth: 1920, maxHeight: 1080, quality: 90 },
			})

			if ('error' in stored) continue

			uploaded.push({
				key: stored.filename,
				name: stored.originalName,
				size: stored.size,
				url: stored.url,
				id: stored.filename,
				status: 'uploaded',
				optimized: true,
			})
		}

		if (uploaded.length === 0) {
			const response: MultiUploadResponse = { success: false, error: 'Tipo de arquivo não permitido.' }
			return NextResponse.json(response, { status: 400 })
		}

		const response: MultiUploadResponse = {
			success: true,
			message: `${uploaded.length} arquivo(s) de problema enviado(s) com sucesso!`,
			data: uploaded,
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('❌ [UPLOAD_PROBLEM] Erro no upload de problema:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

