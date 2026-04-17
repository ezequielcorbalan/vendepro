import type { Hono } from 'hono'
import { D1PropertyRepository, CryptoIdGenerator, R2StorageService } from '@vendepro/infrastructure'
import {
  UploadPropertyPhotoUseCase,
  ReorderPropertyPhotosUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerPhotoRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // ⚠️ /reorder must be registered BEFORE /:id to prevent Hono matching "reorder" as an :id
  app.put('/property-photos/reorder', async (c) => {
    const items = (await c.req.json()) as { id: string; sort_order: number }[]
    if (!Array.isArray(items) || items.length === 0) return c.json({ success: true })
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new ReorderPropertyPhotosUseCase(repo)
    // ReorderPropertyPhotosUseCase.execute(propertyId, orgId, order) — propertyId not needed for reorder
    // The original handler iterated and updated by photo id+orgId without knowing propertyId.
    // Pass empty string as propertyId — adapter uses item.id directly scoped by orgId.
    await useCase.execute('', c.get('orgId'), items)
    return c.json({ success: true })
  })

  app.post('/property-photos', async (c) => {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const propertyId = formData.get('property_id') as string | null
    if (!file || !propertyId) return c.json({ error: 'file y property_id requeridos' }, 400)
    const repo = new D1PropertyRepository(c.env.DB)
    const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
    const idGen = new CryptoIdGenerator()
    const useCase = new UploadPropertyPhotoUseCase(repo, storage, idGen)
    const buffer = await file.arrayBuffer()
    const result = await useCase.execute({
      propertyId,
      orgId: c.get('orgId'),
      fileName: file.name,
      contentType: file.type,
      buffer,
    })
    return c.json(result)
  })

  app.delete('/property-photos/:id', async (c) => {
    const photoId = c.req.param('id')
    const repo = new D1PropertyRepository(c.env.DB)
    const orgId = c.get('orgId')
    const photo = await repo.findPhotoById(photoId, orgId)
    if (!photo) return c.json({ error: 'Not found' }, 404)
    try { await c.env.R2.delete(photo.r2_key) } catch {}
    try {
      await repo.deletePhoto(photoId, orgId)
    } catch {
      return c.json({ error: 'Error al eliminar la foto' }, 500)
    }
    return c.json({ success: true })
  })

  // ── PHOTO UPLOAD (generic, non-property) ─────────────────────
  app.post('/upload-photo', async (c) => {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'No file' }, 400)
    const buffer = await file.arrayBuffer()
    const key = `photos/${c.get('orgId')}/${Date.now()}-${file.name}`
    const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
    const url = await storage.upload(key, buffer, file.type)
    return c.json({ url, key })
  })

  // ── PUBLIC PHOTO PROXY ────────────────────────────────────────
  app.get('/photo/*', async (c) => {
    const key = c.req.path.replace('/photo/', '')
    const object = await c.env.R2.get(key)
    if (!object) return c.json({ error: 'Not found' }, 404)
    const headers = new Headers()
    object.httpMetadata?.contentType && headers.set('Content-Type', object.httpMetadata.contentType)
    headers.set('Cache-Control', 'public, max-age=31536000')
    return new Response(object.body, { headers })
  })
}
