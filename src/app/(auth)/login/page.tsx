import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<LoginForm />
		</div>
	)
}
