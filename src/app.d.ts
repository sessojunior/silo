// Ver https://svelte.dev/docs/kit/types#app.d.ts para informações sobre essas interfaces

import type { IStaticMethods } from 'flyonui/flyonui'

declare global {
	interface Window {
		// Optional plugins
		_
		$: typeof import('jquery')
		jQuery: typeof import('jquery')
		DataTable
		Dropzone
		VanillaCalendarPro

		// Preline UI
		HSStaticMethods: IStaticMethods
	}

	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionValidationResult['user']
			session: import('$lib/server/auth').SessionValidationResult['session']
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
