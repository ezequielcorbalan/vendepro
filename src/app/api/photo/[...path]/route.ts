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

    // Read body as ArrayBuffer
    const body = await object.arrayBuffer()
    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    // Debug: log size
    console.log(`Photo ${key}: ${body.byteLength} bytes, type: ${contentType}`)

    if (body.byteLength === 0) {
      return new Response('Empty file', { status: 404 })
    }

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('Photo serve error:', err)
    return new Response('Error', { status: 500 })
  }
}
