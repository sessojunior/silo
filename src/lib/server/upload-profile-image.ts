import { writeFileSync, existsSync } from 'fs'
import sharp from 'sharp'

// Faz o download de uma imagem de perfil a partir de uma URL (como a do Google),
// redimensiona e converte a imagem para o formato WebP, e salva localmente no diretório especificado.
// A imagem será salva somente se:
// - Ainda não existir uma imagem para o usuário com o mesmo nome.
// - O conteúdo retornado da URL for de fato uma imagem válida.
// - O processo de redimensionamento e conversão for bem-sucedido.
export async function uploadProfileImage(url: string, userId: string): Promise<boolean> {
	// Configurações da imagem
	const imageDirectory = 'static/uploads/profile'
	const outputPath = `${imageDirectory}/${userId}.webp`
	const imageWidth = 64
	const imageHeight = 64
	const imageQuality = 85

	try {
		// Verifica se a imagem já foi salva anteriormente
		if (existsSync(outputPath)) {
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
		const processedImage = await sharp(buffer).rotate().resize(imageWidth, imageHeight, { fit: 'cover' }).webp({ quality: imageQuality }).toBuffer()

		// Salva a imagem processada no caminho final
		writeFileSync(outputPath, processedImage)
		console.log(`Imagem de perfil salva com sucesso para o usuário ${userId}.`)

		return true
	} catch (err) {
		console.error(`Erro ao processar/salvar imagem de perfil para o usuário ${userId}:`, err)
		return false
	}
}
