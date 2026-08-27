import { redirect } from 'next/navigation'

/**
 * Los ids de las secuencias migradas quedan prefijados con `mig-`
 * (ver migración 045), así que el link viejo sigue llevando a la ficha correcta.
 */
export default async function EditarAutomationRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/configuracion/automatizaciones/mig-${id}`)
}
