import { getCurrentUser } from '@/lib/auth'
import { updatePropertyStatus } from '@/lib/actions'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['active', 'sold', 'suspended', 'archived'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as any
  const status = body.status

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  try {
    await updatePropertyStatus(id, status)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
