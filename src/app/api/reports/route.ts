import { createReport } from '@/lib/actions'
import { getCurrentUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = await request.json() as any
    const reportId = await createReport(body.propertyId, {
      periodLabel: body.periodLabel,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      metrics: body.metrics,
      strategy: body.strategy || '',
      marketing: body.marketing || '',
      conclusion: body.conclusion || '',
      priceReference: body.priceReference || '',
      competitors: body.competitors || [],
      publish: body.publish,
    })

    return NextResponse.json({ id: reportId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
