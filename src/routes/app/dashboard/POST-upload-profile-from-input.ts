import { json, type RequestEvent } from '@sveltejs/kit'
import { writeFileSync } from 'fs'
import sharp from 'sharp'

// Rota fazer o upload da imagem de perfil do usuário
// Recebe: fileToUpload (arquivo: File), userId (ID do usuário: number)
// Retorna: JSON no formato { success: true } ou { errors: [{ code: string, message: string }] }
export const POST = async (event: RequestEvent) => {
	// Configurações iniciais
	const IMAGE_WIDTH = 64 // Padrão: 64. Largura final da imagem
	const IMAGE_HEIGHT = 64 // Padrão: 64. Altura final da imagem
	const IMAGE_QUALITY = 85 // Padrão: 85. Qualidade de compactação (0-100) para reduzir o tamanho em bytes da imagem
	const IMAGE_SIZE_UPLOAD = 32 * 1024 * 1024 // Padrão: 32 * 1024 * 1024 (32 MB). Tamanho máximo permitido para upload da imagem
	const IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] // Padrão: ['jpg', 'jpeg', 'png', 'webp']. Extensões de arquivo de imagem permitidas
	const IMAGE_DIRECTORY = 'static/users/profile'

	try {
		const formData = await event.request.formData()
		const file = formData.get('fileToUpload') as File
		const userId = formData.get('userId') as string

		// Verifica se o arquivo e o ID do usuário estão presentes
		if (!file || !userId) {
			return json({ errors: [{ code: 'IMAGE_MISSING_DATA', message: 'Arquivo e ID do usuário são obrigatórios.' }] }, { status: 400 })
		}

		// Verifica o tamanho do arquivo
		if (file.size > IMAGE_SIZE_UPLOAD) {
			return json(
				{ errors: [{ code: 'IMAGE_SIZE_TOO_LARGE', message: `O arquivo excede o tamanho máximo permitido de ${IMAGE_SIZE_UPLOAD / (1024 * 1024)} MB.` }] },
				{ status: 400 }
			)
		}

		// Verifica se a extensão do arquivo é válida
		const fileExtension = file.name.split('.').pop()?.toLowerCase()
		if (!fileExtension || !IMAGE_ALLOWED_EXTENSIONS.includes(fileExtension)) {
			return json({ errors: [{ code: 'IMAGE_INVALID_FORMAT', message: 'Formato inválido. Apenas JPG, PNG e WEBP são permitidos.' }] }, { status: 400 })
		}

		// Lê o arquivo e processa a imagem
		const buffer = Buffer.from(await file.arrayBuffer())
		const image = sharp(buffer).rotate()

		const { width, height } = await image.metadata()
		if (!width || !height) {
			return json({ errors: [{ code: 'IMAGE_READ_ERROR', message: 'Erro ao ler a imagem.' }] }, { status: 400 })
		}

		// Redimensiona e comprime a imagem
		const processedImage = await image.resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' }).webp({ quality: IMAGE_QUALITY }).toBuffer()

		// Função para salvar a imagem no diretório usando arrow function
		const saveImage = (imageBuffer: Buffer, userId: string) => {
			try {
				const outputPath = `${IMAGE_DIRECTORY}/${userId}.webp`
				writeFileSync(outputPath, imageBuffer)
				return json({ success: true }, { status: 200 })
			} catch (err: unknown) {
				console.error('Erro ao salvar a imagem:', err)
				return json({ errors: [{ code: 'IMAGE_SAVE_ERROR', message: 'Erro ao salvar a imagem.' }] }, { status: 500 })
			}
		}

		// Salva a imagem no diretório
		return saveImage(processedImage, userId)
	} catch (err: unknown) {
		console.error('Erro ao processar a imagem:', err)
		return json({ errors: [{ code: 'IMAGE_PROCESS_ERROR', message: 'Erro ao processar a imagem. A imagem pode estar corrompida.' }] }, { status: 400 })
	}
}
