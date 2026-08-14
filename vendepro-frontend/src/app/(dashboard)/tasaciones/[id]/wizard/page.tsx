'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { WizardShell } from '@/components/tasaciones/wizard/WizardShell'
import { getAppraisal } from '@/components/tasaciones/shared/api'
import type { WizardState } from '@/components/tasaciones/wizard/use-wizard-form'

export default function EditarWizardPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialData, setInitialData] = useState<Partial<WizardState> | null>(null)
  const [comparableIds, setComparableIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const a = await getAppraisal(id)
        if (cancelled) return
        setInitialData({
          template_id: a.template_id ?? null,
          property_id: a.property_id ?? null,
          lead_id: a.lead_id ?? null,
          step: a.template_id ? 2 : 1,
          property: {
            address: a.property_address ?? '',
            neighborhood: a.neighborhood ?? undefined,
            city: a.city ?? undefined,
            property_type: a.property_type ?? undefined,
            covered_area: a.covered_area ?? null,
            total_area: a.total_area ?? null,
            semi_area: a.semi_area ?? null,
            weighted_area: a.weighted_area ?? null,
          },
          details: {
            strengths: a.strengths ?? null,
            weaknesses: a.weaknesses ?? null,
            opportunities: a.opportunities ?? null,
            threats: a.threats ?? null,
            suggested_price: a.suggested_price ?? null,
            test_price: a.test_price ?? null,
            expected_close_price: a.expected_close_price ?? null,
            usd_per_m2: a.usd_per_m2 ?? null,
          },
          comparables: (a.comparables ?? []).map((c: any) => ({
            kind: c.kind ?? 'publicacion',
            zonaprop_url: c.zonaprop_url ?? null,
            address: c.address ?? null,
            total_area: c.total_area ?? null,
            covered_area: c.covered_area ?? null,
            price: c.price ?? null,
            usd_per_m2: c.usd_per_m2 ?? null,
            days_on_market: c.days_on_market ?? null,
            views_per_day: c.views_per_day ?? null,
            age: c.age ?? null,
            closing_price_usd: c.closing_price_usd ?? null,
            closed_at: c.closed_at ?? null,
            source_sold_property_id: c.source_sold_property_id ?? null,
          })),
          blockOverrides: (a.block_overrides_json as any) ?? {},
        })
        setComparableIds((a.comparables ?? []).map((c: any) => c.id as string))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'No se pudo cargar la tasación')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !initialData) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Text tone="danger">{error ?? 'Tasación no encontrada'}</Text>
        <Button onClick={() => router.push('/tasaciones')} className="mt-4">
          Volver al listado
        </Button>
      </div>
    )
  }

  return (
    <WizardShell
      existingAppraisalId={id}
      existingComparableIds={comparableIds}
      initialData={initialData}
    />
  )
}
