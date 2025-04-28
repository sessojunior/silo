interface Problem {
	id: string
	title: string
	date: string
	description: string
	solutions: number
}

// interface Solution {
// 	id: string
// 	replyId: string | null
// 	date: string
// 	userId: number
// 	userName: string
// 	description: string
// 	verified: boolean
// }

const problems: Problem[] = [
	{
		id: '1',
		title: 'Problema augue velit sagittis in purus blandit vulputate 1',
		date: '2025-02-09 07:08:00',
		description:
			'Praesent augue velit, sagittis in purus blandit, vulputate volutpat est. Etiam vel justo justo. Praesent eget tempor lectus, sed placerat turpis. Cras consequat et lacus et suscipit. Nam vitae turpis feugiat, interdum nunc a, tincidunt velit...',
		solutions: 5
	},
	{
		id: '2',
		title: 'Problema eget vulputate 2',
		date: '2025-01-09 11:47:00',
		description:
			'Aenean ut turpis dui. Pellentesque a efficitur odio, eu volutpat nisi. Nulla ornare tincidunt auctor. Nam ac velit mi. Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Vivamus vestibulum mi nisl, eu rutrum quam cursus in. Duis vitae mattis mi, at suscipit massa...',
		solutions: 0
	},
	{
		id: '3',
		title: 'Problema placerat turpis interdum vulputate volutpat nunc 3',
		date: '2025-02-13 13:45:00',
		description:
			'Nunc a nisi ipsum. Mauris iaculis metus ut euismod venenatis. Ut commodo, elit ac accumsan vulputate, urna purus sodales augue, ut congue enim tortor ac lacus. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula, vitae auctor ligula...',
		solutions: 2
	},
	{
		id: '4',
		title: 'Zone efficitur efficitur odio 4',
		date: '2025-01-09 11:47:00',
		description:
			'Pellentesque a efficitur odio ornare tincidunt auctor. Nam ac velit mi. Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Vivamus vestibulum mi nisl, eu rutrum quam cursus in. Duis vitae mattis mi, at suscipit massa...',
		solutions: 0
	}
]

// const problems: Problem[] = []
const problem = {
	id: '1',
	title: 'Problema augue velit sagittis in purus blandit vulputate 1',
	date: '2025-02-09 07:08:00',
	description: `
	    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean quis efficitur tellus. Suspendisse vitae justo lacinia, dictum orci mattis, fermentum dui.</p>
	    <p>
	      Nulla efficitur porta velit, in sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec vehicula nulla quis laoreet convallis. In malesuada
	      ligula vel molestie sagittis.
	    </p>
	    <p>Cras non lacus id est accumsan vestibulum.</p>
	  `,
	screenshots: [
		{ id: '1', src: 'https://confluence.ecmwf.int/download/attachments/52464844/worddavf74394bf4344047a1d0f1835d6740525.png', alt: 'Screenshot 1' },
		{ id: '2', src: 'https://confluence.ecmwf.int/download/attachments/52464881/worddav2b63bcd14ea990b6058f3dd44b65ab79.png', alt: 'Screenshot 2' }
	],
	// solutions: []
	solutions: [
		{
			id: '1.1',
			replyId: null,
			date: '2025-02-17 11:39:00',
			user: {
				id: '1',
				name: 'Ronaldo Gaúcho',
				avatar: 'https://randomuser.me/api/portraits/men/1.jpg'
			},
			description:
				'Praesent eget tempor lectus, sed placerat turpis. Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Vivamus vestibulum mi nisl, eu rutrum quam cursus in. Cras consequat et lacus et suscipit. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula.',
			verified: false
		},
		{
			id: '1.2',
			replyId: null,
			date: '2025-02-15 22:40',
			user: {
				id: '2',
				name: 'Angélica Carioca',
				avatar: 'https://randomuser.me/api/portraits/women/2.jpg'
			},
			description:
				'Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula.',
			verified: false
		},
		{
			id: '1.2.1',
			replyId: '1.2',
			date: '2025-02-16 11:32:00',
			user: {
				id: '3',
				name: 'Rafael Dias',
				avatar: 'https://randomuser.me/api/portraits/men/3.jpg'
			},
			description: 'Quisque eget est ipsum. Phasellus a augue a nibh placerat facilisis?',
			verified: false
		},
		{
			id: '1.2.2',
			replyId: '1.2',
			date: '2025-02-16 21:07:00',
			user: {
				id: '4',
				name: 'Anderson Santos',
				avatar: 'https://randomuser.me/api/portraits/men/4.jpg'
			},
			description: 'Ut id libero non tortor ullamcorper porta sit amet eget justo. Proin viverra vitae nibh vel placerat. Donec sed pellentesque libero, ac ultrices felis.',
			verified: true
		},
		{
			id: '1.3',
			replyId: null,
			date: '2025-02-09 07:08:00',
			user: {
				id: '5',
				name: 'Mateus Gonçalves',
				avatar: 'https://randomuser.me/api/portraits/men/5.jpg'
			},
			description:
				'Aenean vehicula placerat lectus, vel facilisis odio gravida non. Suspendisse nisi nisl, venenatis vitae laoreet vel, tempor sit amet velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
			verified: false
		},
		{
			id: '1.3.1',
			replyId: '1.3',
			date: '2025-02-16 21:07:00',
			user: {
				id: '6',
				name: 'Carlitos Dantes',
				avatar: 'https://randomuser.me/api/portraits/men/6.jpg'
			},
			description: 'Morbi finibus tellus vel turpis fermentum.',
			verified: false
		}
	]
}

export function load() {
	return {
		problem,
		problems
	}
}
