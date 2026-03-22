import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    // Get report to find property_id
    const report = await db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first() as any
    if (!report) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

    // Only admin or the creator can delete
    if (user.role !== 'admin' && report.created_by !== user.id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Delete photos from R2
    const photos = (await db.prepare('SELECT * FROM report_photos WHERE report_id = ?').bind(id).all()).results as any[]
    if (photos.length > 0) {
      try {
        const { env } = await getCloudflareContext()
        const r2 = (env as any).R2 as R2Bucket
        for (const photo of photos) {
          const key = (photo.photo_url as string).replace('/api/photo/', '')
          await r2.delete(key)
        }
      } catch {
        // R2 cleanup is best-effort
      }
    }

    // Delete all related data
    await db.prepare('DELETE FROM report_photos WHERE report_id = ?').bind(id).run()
    await db.prepare('DELETE FROM report_content WHERE report_id = ?').bind(id).run()
    await db.prepare('DELETE FROM report_metrics WHERE report_id = ?').bind(id).run()
    await db.prepare('DELETE FROM reports WHERE id = ?').bind(id).run()

    return NextResponse.json({ success: true, propertyId: report.property_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al eliminar' }, { status: 500 })
  }
}
