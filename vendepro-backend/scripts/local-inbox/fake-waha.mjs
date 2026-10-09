#!/usr/bin/env node
/**
 * Un WAHA de mentira para probar la conexión sin Docker ni un teléfono.
 *
 *   node scripts/local-inbox/fake-waha.mjs            → escucha en 3001
 *   node scripts/local-inbox/fake-waha.mjs --working  → arranca ya vinculado
 *
 * Implementa lo que VendéPro le pide a WAHA:
 *   POST /api/sessions              crear/arrancar (y guardar su webhook)
 *   POST /api/sessions/{s}/start    arrancar una existente
 *   GET  /api/sessions/{s}          estado
 *   GET  /api/{s}/auth/qr           QR en base64
 *   POST /api/sendText              enviar un mensaje
 *
 * Imprime lo que recibe, así se ve si el webhook por sesión llega bien
 * armado — que es la pieza de la que depende el WAHA compartido.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 3001)
const sesiones = new Map()
const arrancaVinculado = process.argv.includes('--working')

// Un PNG 1x1 alcanza: lo que se prueba es que llegue y se pinte, no el dibujo.
const QR_FALSO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  let raw = ''
  req.on('data', c => { raw += c })
  req.on('end', () => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const ruta = url.pathname
    const body = raw ? JSON.parse(raw) : null

    if (req.method === 'POST' && ruta === '/api/sessions') {
      const nombre = body?.name ?? 'default'
      const webhook = body?.config?.webhooks?.[0]
      sesiones.set(nombre, { estado: arrancaVinculado ? 'WORKING' : 'SCAN_QR_CODE', webhook })
      console.log(`\n▶ sesión "${nombre}" creada`)
      console.log(`  webhook → ${webhook?.url ?? '(ninguno)'}`)
      for (const h of webhook?.customHeaders ?? []) {
        const valor = h.name.toLowerCase() === 'authorization' ? `${String(h.value).slice(0, 24)}…` : h.value
        console.log(`  header  → ${h.name}: ${valor}`)
      }
      console.log(`  eventos → ${(webhook?.events ?? []).join(', ') || '(ninguno)'}`)
      return json(res, 201, { name: nombre, status: sesiones.get(nombre).estado })
    }

    const start = ruta.match(/^\/api\/sessions\/([^/]+)\/start$/)
    if (req.method === 'POST' && start) {
      const nombre = decodeURIComponent(start[1])
      sesiones.set(nombre, sesiones.get(nombre) ?? { estado: 'SCAN_QR_CODE' })
      console.log(`▶ sesión "${nombre}" arrancada`)
      return json(res, 200, { name: nombre, status: sesiones.get(nombre).estado })
    }

    const detalle = ruta.match(/^\/api\/sessions\/([^/]+)$/)
    if (req.method === 'GET' && detalle) {
      const nombre = decodeURIComponent(detalle[1])
      const s = sesiones.get(nombre)
      if (!s) return json(res, 404, { error: 'session not found' })
      return json(res, 200, {
        name: nombre,
        status: s.estado,
        me: s.estado === 'WORKING' ? { pushName: 'Inmobiliaria Local', id: '5491155551234@c.us' } : null,
      })
    }

    const qr = ruta.match(/^\/api\/([^/]+)\/auth\/qr$/)
    if (req.method === 'GET' && qr) return json(res, 200, { mimetype: 'image/png', data: QR_FALSO })

    if (req.method === 'POST' && ruta === '/api/sendText') {
      console.log(`✉ enviar a ${body?.chatId}: ${body?.text}`)
      return json(res, 201, { id: { _serialized: `false_${body?.chatId}_${Date.now()}` } })
    }

    json(res, 404, { error: `sin ruta para ${req.method} ${ruta}` })
  })
}).listen(PORT, () => {
  console.log(`WAHA de mentira en http://localhost:${PORT}`)
  console.log(arrancaVinculado ? 'Arranca VINCULADO (WORKING).' : 'Arranca pidiendo QR (SCAN_QR_CODE).')
})
