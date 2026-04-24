import { WizardShell } from '@/components/tasaciones/wizard/WizardShell'

export default async function NuevaTasacionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const qp = await searchParams
  return <WizardShell initialTemplateId={qp?.template ?? null} />
}
