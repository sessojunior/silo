import { promises as fs, mkdirSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

export type UploadKind = 'general' | 'avatars' | 'contacts' | 'problems' | 'solutions'

const uploadKinds: ReadonlyArray<UploadKind> = ['general', 'avatars', 'contacts', 'problems', 'solutions']

export const isUploadKind = (value: string): value is UploadKind => uploadKinds.includes(value as UploadKind)

const maxFileSizeBytes = 4 * 1024 * 1024
const allowedInputFormats: ReadonlyArray<string> = ['jpeg', 'png', 'webp', 'gif']

const getUploadsRoot = (): string => path.join(process.cwd(), 'uploads')

export const ensureUploadDir = (kind: UploadKind): string => {
	const dirPath = path.join(getUploadsRoot(), kind)
	mkdirSync(dirPath, { recursive: true })
	return dirPath
}

const createWebpFilename = (originalName: string): string => {
	const baseName = path.basename(originalName).replace(/\.[^/.]+$/, '')
	const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40)
	const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
	const prefix = Date.now().toString(10)
	const namePart = safeBaseName.length > 0 ? `${safeBaseName}-` : ''
	return `${prefix}-${namePart}${suffix}.webp`
}

export type ImageProcessOptions =
	| { mode: 'square'; size: number; quality: number }
	| { mode: 'inside'; maxWidth: number; maxHeight: number; quality: number }

export type StoredUpload = {
	filename: string
	originalName: string
	size: number
	url: string
}

const toBuffer = async (file: File): Promise<Buffer> => Buffer.from(await file.arrayBuffer())

const validateImageBuffer = async (buffer: Buffer): Promise<{ ok: true } | { ok: false; message: string }> => {
	try {
		const metadata = await sharp(buffer).metadata()
		if (!metadata.format) return { ok: false, message: 'Não foi possível identificar o formato da imagem.' }
		if (!allowedInputFormats.includes(metadata.format)) return { ok: false, message: 'Tipo de arquivo não permitido.' }
		if (!metadata.width || !metadata.height) return { ok: false, message: 'Imagem inválida.' }
		return { ok: true }
	} catch {
		return { ok: false, message: 'Imagem inválida.' }
	}
}

const processToWebp = async (buffer: Buffer, options: ImageProcessOptions): Promise<Buffer> => {
	const image = sharp(buffer).rotate()
	if (options.mode === 'square') {
		return image.resize(options.size, options.size, { fit: 'cover' }).webp({ quality: options.quality }).toBuffer()
	}
	return image
		.resize(options.maxWidth, options.maxHeight, { fit: 'inside', withoutEnlargement: true })
		.webp({ quality: options.quality })
		.toBuffer()
}

export const storeImageAsWebp = async (params: {
	file: File
	kind: UploadKind
	requestUrl: string
	options: ImageProcessOptions
}): Promise<StoredUpload | { error: string }> => {
	const { file, kind, requestUrl, options } = params

	if (file.size > maxFileSizeBytes) {
		return { error: 'Arquivo muito grande. Máximo 4MB.' }
	}

	const buffer = await toBuffer(file)
	const validation = await validateImageBuffer(buffer)
	if (!validation.ok) return { error: validation.message }

	const filename = createWebpFilename(file.name)
	const dirPath = ensureUploadDir(kind)
	const filePath = path.join(dirPath, filename)

	const processed = await processToWebp(buffer, options)
	await fs.writeFile(filePath, processed)

	const origin = new URL(requestUrl).origin
	const url = `${origin}/files/${kind}/${filename}`

	return { filename, originalName: file.name, size: file.size, url }
}

export const getUploadFilePath = (kind: UploadKind, filename: string): string => path.join(getUploadsRoot(), kind, filename)

export const deleteUploadFile = async (kind: UploadKind, filename: string): Promise<boolean> => {
	try {
		await fs.unlink(getUploadFilePath(kind, filename))
		return true
	} catch {
		return false
	}
}

export const readUploadFile = async (kind: UploadKind, filename: string): Promise<Buffer | null> => {
	try {
		return await fs.readFile(getUploadFilePath(kind, filename))
	} catch {
		return null
	}
}

export const getContentTypeFromFilename = (filename: string): string => {
	const ext = path.extname(filename).toLowerCase()
	if (ext === '.webp') return 'image/webp'
	if (ext === '.png') return 'image/png'
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
	if (ext === '.gif') return 'image/gif'
	return 'application/octet-stream'
}

export const isSafeFilename = (filename: string): boolean => {
	if (filename.includes('..')) return false
	if (filename.includes('/') || filename.includes('\\')) return false
	return path.basename(filename) === filename
}
