import { NextResponse } from 'next/server'
import { updatePropertyPrice } from '@/lib/actions'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as any

  try {
    await updatePropertyPrice(id, body.price, body.currency, body.reason)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
