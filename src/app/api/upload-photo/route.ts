import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { generateId } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const r2 = (env as any).R2 as R2Bucket

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const reportId = formData.get('reportId') as string
    const caption = formData.get('caption') as string || ''
    const photoType = formData.get('photoType') as string || 'visit_form'
    const sortOrder = parseInt(formData.get('sortOrder') as string || '0')

    if (!file || !reportId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Upload to R2
    const fileId = generateId()
    const ext = file.name.split('.').pop() || 'jpg'
    const key = `photos/${reportId}/${fileId}.${ext}`

    const bytes = await file.arrayBuffer()
    await r2.put(key, bytes, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    })

    // The photo URL will be served via a public R2 URL or worker route
    const photoUrl = `/api/photo/${key}`

    // Save to DB
    const db = (env as any).DB as D1Database
    const id = generateId()
    await db.prepare(
      'INSERT INTO report_photos (id, report_id, photo_url, caption, photo_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, reportId, photoUrl, caption, photoType, sortOrder).run()

    return NextResponse.json({ id, photo_url: photoUrl })
  } catch (err: any) {
    console.error('Upload photo error:', err)
    return NextResponse.json({ error: err.message || 'Error al subir foto' }, { status: 500 })
  }
}
