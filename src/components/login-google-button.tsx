"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { FcGoogle } from "react-icons/fc"

export function SignInWithGoogleButton() {
	return (
		<>
			<Button variant='outline' type='button' className='w-full' onClick={() => signIn("google")}>
				<FcGoogle /> Login com Google
			</Button>
		</>
	)
}
