import { signIn } from "@/auth-node"
import { Button } from "@/components/ui/button"
import { FcGoogle } from "react-icons/fc"

export function SignInWithGoogleButton() {
	return (
		<form
			action={async () => {
				"use server"
				await signIn("google")
			}}
		>
			<Button variant='outline' type='submit' className='w-full'>
				<FcGoogle /> Login com Google
			</Button>
		</form>
	)
}
