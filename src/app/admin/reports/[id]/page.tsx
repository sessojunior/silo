import { ReportViewPage } from '@/components/admin/reports/ReportViewPage'

interface ReportPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ReportPageRoute({ params }: ReportPageProps) {
	const { id } = await params
	return <ReportViewPage reportId={id} />
}
