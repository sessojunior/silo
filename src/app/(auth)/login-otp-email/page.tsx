"use client"

import LoginOtpEmailForm from "@/components/login-otp-email-form"
import LoginOtpKeyForm from "@/components/login-otp-key-form"

import { useState } from "react"

export default function LoginOtpEmailPage() {
	const [verificationEmail, setVerificationEmail] = useState<string | null>(null)

	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			{!verificationEmail ? <LoginOtpEmailForm onEmailSubmitted={setVerificationEmail} /> : <LoginOtpKeyForm email={verificationEmail} />}
		</div>
	)
}
