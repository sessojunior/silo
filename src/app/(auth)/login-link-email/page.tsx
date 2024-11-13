"use client"

import LoginLinkEmailForm from "@/components/login-link-email-form"
import LoginLinkResumeForm from "@/components/login-link-resume-form"

import { useState } from "react"

export default function LoginLinkEmailPage() {
	const [verificationEmail, setVerificationEmail] = useState<string | null>(null)

	function handleRetry() {
		setVerificationEmail(null) // Voltar para o formulário
	}

	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			{!verificationEmail ? <LoginLinkEmailForm initialEmail={verificationEmail || ""} onEmailSubmitted={setVerificationEmail} /> : <LoginLinkResumeForm email={verificationEmail} onRetry={handleRetry} />}
		</div>
	)
}
