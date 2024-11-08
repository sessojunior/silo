import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"

export function SignInWithGoogleButton() {
	return (
		<form
			action={async () => {
				"use server"
				await signIn("google")
			}}
		>
			<Button variant='outline' type='submit' className='w-full'>
				Login com Google
			</Button>
		</form>
	)
}
