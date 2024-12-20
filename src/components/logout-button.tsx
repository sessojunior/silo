import { signOut } from "@/auth-node"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
	return (
		<form
			action={async () => {
				"use server"
				await signOut()
			}}
		>
			<Button variant='default' type='submit'>
				Sair
			</Button>
		</form>
	)
}
