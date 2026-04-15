import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    const report = await db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first() as any
    if (!report) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

    const metrics = (await db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').bind(id).all()).results as any[]
    const content = (await db.prepare('SELECT * FROM report_content WHERE report_id = ?').bind(id).all()).results as any[]
    const competitors = (await db.prepare('SELECT * FROM competitor_links WHERE property_id = ?').bind(report.property_id).all()).results as any[]

    return NextResponse.json({ report, metrics, content, competitors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as any
  const db = await getDB()

  try {
    const report = await db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first() as any
    if (!report) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    if (user.role !== 'admin' && report.created_by !== user.id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const status = body.publish ? 'published' : 'draft'
    const publishedAt = body.publish ? new Date().toISOString() : null

    await db.prepare(
      "UPDATE reports SET period_label = ?, period_start = ?, period_end = ?, status = ?, published_at = ? WHERE id = ?"
    ).bind(
      body.periodLabel || report.period_label,
      body.periodStart || report.period_start,
      body.periodEnd || report.period_end,
      status,
      publishedAt || report.published_at,
      id
    ).run()

    // Replace metrics
    if (Array.isArray(body.metrics)) {
      await db.prepare('DELETE FROM report_metrics WHERE report_id = ?').bind(id).run()
      for (const m of body.metrics) {
        await db.prepare(
          `INSERT INTO report_metrics (id, report_id, source, impressions, portal_visits, inquiries, phone_calls, whatsapp, in_person_visits, offers, ranking_position, avg_market_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(), id, m.source || 'zonaprop',
          m.impressions ? Number(m.impressions) : null,
          m.portal_visits ? Number(m.portal_visits) : null,
          m.inquiries ? Number(m.inquiries) : null,
          m.phone_calls ? Number(m.phone_calls) : null,
          m.whatsapp ? Number(m.whatsapp) : null,
          m.in_person_visits ? Number(m.in_person_visits) : null,
          m.offers ? Number(m.offers) : null,
          m.ranking_position ? Number(m.ranking_position) : null,
          m.avg_market_price ? Number(m.avg_market_price) : null,
        ).run()
      }
    }

    // Replace content sections
    const sections: Array<[string, string]> = [
      ['strategy', body.strategy || ''],
      ['marketing', body.marketing || ''],
      ['conclusion', body.conclusion || ''],
      ['price_reference', body.priceReference || ''],
    ]
    await db.prepare('DELETE FROM report_content WHERE report_id = ?').bind(id).run()
    for (const [section, bodyText] of sections) {
      if (bodyText) {
        await db.prepare(
          'INSERT INTO report_content (id, report_id, section, title, body, sort_order) VALUES (?, ?, ?, ?, ?, 0)'
        ).bind(generateId(), id, section, '', bodyText).run()
      }
    }

    return NextResponse.json({ success: true, id, propertyId: report.property_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar' }, { status: 500 })
  }
}

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
