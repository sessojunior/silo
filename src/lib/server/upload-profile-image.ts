import { existsSync, writeFileSync } from 'fs'
import { Buffer } from 'buffer'
import sharp from 'sharp'

// Faz o upload de uma imagem de perfil a partir de uma URL (como a do Google),
// redimensiona e converte a imagem para o formato WebP, e salva localmente no diretório especificado.
// A imagem será salva somente se:
// - Ainda não existir uma imagem para o usuário com o mesmo nome.
// - O conteúdo retornado da URL for de fato uma imagem válida.
// - O processo de redimensionamento e conversão for bem-sucedido.
export async function uploadProfileImageFromUrl(url: string, userId: string): Promise<boolean> {
	// Configurações da imagem
	const IMAGE_DIRECTORY = 'static/uploads/avatar'
	const OUTPUT_PATH = `${IMAGE_DIRECTORY}/${userId}.webp`
	const IMAGE_WIDTH = 64
	const IMAGE_HEIGHT = 64
	const IMAGE_QUALITY = 85

	try {
		// Verifica se a imagem já foi salva anteriormente
		if (existsSync(OUTPUT_PATH)) {
			console.log(`Imagem de perfil já existe para o usuário ${userId}. Nenhuma ação foi realizada.`)
			return false
		}

		// Realiza o download da imagem da URL fornecida
		const response = await fetch(url)

		// Garante que a requisição foi bem-sucedida (status HTTP 2xx)
		if (!response.ok) {
			throw new Error(`Falha ao baixar imagem. Status HTTP: ${response.status}`)
		}

		// Verifica se o conteúdo retornado é de fato uma imagem
		const contentType = response.headers.get('content-type') || ''
		if (!contentType.startsWith('image/')) {
			throw new Error(`Tipo de conteúdo inválido: ${contentType}. Esperado tipo 'image/*'.`)
		}

		// Converte o corpo da resposta (ArrayBuffer) em um Buffer (compatível com o Sharp)
		const buffer = Buffer.from(await response.arrayBuffer())

		// Processa a imagem:
		// - Gira automaticamente se necessário (com base em metadados EXIF)
		// - Redimensiona a imagem, usando 'cover' para preencher o espaço
		// - Converte para WebP com qualidade de 75%
		const processedImage = await sharp(buffer).rotate().resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' }).webp({ quality: IMAGE_QUALITY }).toBuffer()

		// Salva a imagem processada no caminho final
		writeFileSync(OUTPUT_PATH, processedImage)
		console.log(`Imagem de perfil salva com sucesso para o usuário ${userId}.`)

		return true
	} catch (err) {
		console.error(`Erro ao processar/salvar imagem de perfil para o usuário ${userId}:`, err)
		return false
	}
}

// Faz o upload de uma imagem a partir de um input file,
// redimensiona e converte para o formato WebP, e salva localmente no diretório especificado.
export async function uploadProfileImageFromInput(file: File, userId: string): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Configurações da imagem
	const IMAGE_DIRECTORY = 'static/uploads/avatar'
	const OUTPUT_PATH = `${IMAGE_DIRECTORY}/${userId}.webp`
	const IMAGE_WIDTH = 64
	const IMAGE_HEIGHT = 64
	const IMAGE_QUALITY = 85
	const IMAGE_SIZE_UPLOAD = 32 * 1024 * 1024 // 32 MB
	const IMAGE_ALLOWED_FORMATS = ['jpeg', 'png', 'webp']

	// Verifica se o ID do usuário foi fornecido
	if (!userId) {
		console.warn('ID do usuário ausente.')
		return { error: { code: 'IMAGE_MISSING_DATA', message: 'O ID do usuário é obrigatório.' } }
	}

	// Verifica se o arquivo foi fornecido
	if (!userId) {
		console.warn('Arquivo de imagem do usuário ausente.')
		return { error: { code: 'IMAGE_MISSING_DATA', message: 'A imagem do usuário não foi enviada.' } }
	}

	try {
		// Valida o tamanho do arquivo
		if (file.size > IMAGE_SIZE_UPLOAD) {
			console.warn(`Arquivo excede o limite de ${IMAGE_SIZE_UPLOAD / (1024 * 1024)} MB.`)
			return { error: { code: 'IMAGE_SIZE_TOO_LARGE', message: `O arquivo da imagem excede o limite de ${IMAGE_SIZE_UPLOAD / (1024 * 1024)} MB.` } }
		}

		// Converte para buffer e lê metadados
		const buffer = Buffer.from(await file.arrayBuffer())
		const image = sharp(buffer).rotate()
		const metadata = await image.metadata()

		// Verifica se o formato da imagem é permitido
		if (!metadata.format || !IMAGE_ALLOWED_FORMATS.includes(metadata.format)) {
			console.warn(`Formato de imagem inválido detectado: ${metadata.format}`)
			return {
				error: {
					code: 'IMAGE_INVALID_FORMAT',
					message: `Formato de imagem inválido: "${metadata.format}". Apenas JPG, PNG e WebP são permitidos.`
				}
			}
		}

		// Verifica se a largura e altura da imagem foram obtidas
		if (!metadata.width || !metadata.height) {
			console.warn('Não foi possível obter os dados da imagem.')
			return { error: { code: 'IMAGE_METADATA_NOT_FOUND', message: 'Não foi possivel obter os dados da imagem.' } }
		}

		// Redimensiona e converte para WebP
		const processedImage = await image.resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' }).webp({ quality: IMAGE_QUALITY }).toBuffer()

		// Caminho final e salvamento
		writeFileSync(OUTPUT_PATH, processedImage)
		console.log(`Imagem de perfil salva em ${OUTPUT_PATH}.`)

		return { success: true }
	} catch (err) {
		console.error(`Erro ao processar ou salvar imagem de perfil do usuário ${userId}:`, err)
		return { error: { code: 'IMAGE_PROCESSING_ERROR', message: 'Erro ao processar ou salvar a imagem.' } }
	}
}
