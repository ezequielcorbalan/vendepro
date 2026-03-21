import { login } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email: string; password: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const user = await login(email, password)

  if (!user) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  return NextResponse.json({ success: true, user: { id: user.id, full_name: user.full_name, role: user.role } })
}
