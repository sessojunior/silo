import type { NextConfig } from 'next'

const parseAppUrl = (): { protocol: 'http' | 'https'; hostname: string; port?: string } | null => {
	const raw = process.env.APP_URL
	if (!raw) return null
	try {
		const url = new URL(raw)
		const protocol = (url.protocol.replace(':', '') || 'https') as 'http' | 'https'
		const hostname = url.hostname
		const port = url.port || undefined
		return { protocol, hostname, port }
	} catch {
		return null
	}
}

const appUrl = parseAppUrl()

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: 'http',
				hostname: 'localhost',
				pathname: '/files/**',
			},
			{
				protocol: 'http',
				hostname: '127.0.0.1',
				pathname: '/files/**',
			},
			...(appUrl
				? [
						{
							protocol: appUrl.protocol,
							hostname: appUrl.hostname,
							port: appUrl.port,
							pathname: '/files/**',
						},
					]
				: []),
		],
	}
}

export default nextConfig
