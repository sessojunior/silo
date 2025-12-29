import { redirect } from 'next/navigation'

export default function AdminPage() {
	// Redireciona automaticamente para o dashboard
	redirect('/admin/dashboard')
}
