import { NextRequest, NextResponse } from 'next/server'

// Proteção de rotas privadas
// Redireciona páginas /admin/* sem sessão para login
// APIs /api/admin/* fazem verificação básica de token no proxy + verificação completa nas próprias APIs

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl
	const token = req.cookies.get('session_token')?.value

	// Proteção de páginas administrativas
	if (pathname.startsWith('/admin')) {
		if (!token) {
			return NextResponse.redirect(new URL('/login', req.url))
		}
		return NextResponse.next()
	}

	// Proteção de APIs administrativas - verificação básica de token
	if (pathname.startsWith('/api/admin/')) {
		if (!token) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		return NextResponse.next()
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/admin/:path*', '/api/admin/:path*'],
}

