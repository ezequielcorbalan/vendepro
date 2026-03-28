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

    // Read the full body as ArrayBuffer to avoid streaming issues
    const arrayBuffer = await object.arrayBuffer()
    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('Photo serve error:', err)
    return new Response('Error', { status: 500 })
  }
}
