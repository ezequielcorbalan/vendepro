import { NextResponse } from 'next/server'
import { updatePropertyPrice } from '@/lib/actions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as any

  try {
    await updatePropertyPrice(id, body.price, body.currency, body.reason)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
