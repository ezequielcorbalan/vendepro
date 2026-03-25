import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'

// PUT /api/auth/password — change password
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const data = (await request.json()) as any
  const { current_password, new_password } = data

  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }
  if (new_password.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const db = await getDB()

  try {
    // Verify current password
    const dbUser = (await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first()) as any
    if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const currentHash = await hashPassword(current_password)
    if (currentHash !== dbUser.password_hash) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 403 })
    }

    // Update to new password
    const newHash = await hashPassword(new_password)
    await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(newHash, user.id).run()

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
