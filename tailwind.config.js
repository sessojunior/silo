/** @type {import('tailwindcss').Config} */
export default {
	content: ['./node_modules/preline/preline.js'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
			},
		},
	},
	plugins: [require('@tailwindcss/forms'), require('preline/plugin')],
	darkMode: 'class',
}
