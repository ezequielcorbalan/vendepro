import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const key = path.join('/')

  try {
    const { env } = await getCloudflareContext()
    const r2 = (env as any).R2 as R2Bucket

    const object = await r2.get(key)
    if (!object) {
      return new Response('Not found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')

    return new Response(object.body as ReadableStream, { headers })
  } catch (err: any) {
    console.error('Photo serve error:', err)
    return new Response('Error', { status: 500 })
  }
}
