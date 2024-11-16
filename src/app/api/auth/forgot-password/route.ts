import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ message: "Método não permitido." })
	}

	const { email } = req.body

	if (!email) {
		return res.status(400).json({ message: "E-mail é obrigatório." })
	}

	// Simulação do envio de e-mail (substituir pela sua lógica real de envio de e-mail)
	try {
		console.log(`E-mail de recuperação enviado para: ${email}`)
		// Implementar envio real aqui, por exemplo, usando Nodemailer.
		res.status(200).json({ message: "E-mail de recuperação enviado." })
	} catch (error) {
		console.error("Erro ao enviar o e-mail:", error)
		res.status(500).json({ message: "Erro ao enviar o e-mail de recuperação." })
	}
}
