import { WizardShell } from '@/components/tasaciones/wizard/WizardShell'

export default async function NuevaTasacionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; lead_id?: string }>
}) {
  const qp = await searchParams
  return <WizardShell initialTemplateId={qp?.template ?? null} initialLeadId={qp?.lead_id ?? null} />
}
