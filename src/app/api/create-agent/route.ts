import { getCurrentUser } from '@/lib/auth'
import { createAgent } from '@/lib/actions'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json() as { email: string; password: string; full_name: string; phone?: string; role: string }
  const result = await createAgent(body)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: result.id })
}
