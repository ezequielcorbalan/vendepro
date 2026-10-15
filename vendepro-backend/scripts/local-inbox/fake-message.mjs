#!/usr/bin/env node
/**
 * Simula un mensaje entrante contra el worker local, sin WhatsApp de por medio.
 *
 *   node scripts/local-inbox/fake-message.mjs "Hola, vi el depto de Cabildo"
 *   node scripts/local-inbox/fake-message.mjs "Otro mensaje" --from 5491144449999
 *
 * Sirve para ver el circuito completo —conversación, contacto, ventana de 24h,
 * idempotencia— antes de conectar un número de verdad. Mandá el mismo mensaje
 * dos veces con el mismo --id y vas a ver `duplicate: true` la segunda.
 */
const args = process.argv.slice(2)
const texto = args.find(a => !a.startsWith('--')) ?? 'Hola, quería consultar por una propiedad'

function flag(nombre, porDefecto) {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto
}

const url = flag('url', 'http://localhost:8708/v1/inbox/messages')
const telefono = flag('from', '5491155551234')
const token = flag('token', process.env.INBOX_TOKEN)

if (!token) {
  console.error('Falta el token. Pasalo con --token <jwt> o exportá INBOX_TOKEN.')
  console.error('Lo imprime: node scripts/local-inbox/seed-local.mjs')
  process.exit(1)
}

const body = {
  channel: 'whatsapp',
  chat_id: `${telefono}@c.us`,
  message_id: flag('id', `local-${Date.now()}`),
  from_phone: telefono,
  from_name: flag('name', 'Juan Prueba'),
  content: texto,
  sent_at: new Date().toISOString(),
}

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})

const texto_respuesta = await res.text()
console.log(`HTTP ${res.status}`)
try {
  const data = JSON.parse(texto_respuesta)
  console.log(JSON.stringify(data, null, 2))
  if (data.duplicate) console.log('\n→ Ya estaba guardado: la ingesta es idempotente.')
  else if (data.conversationCreated) console.log('\n→ Conversación nueva creada.')
  else console.log('\n→ Mensaje agregado a una conversación que ya existía.')
} catch {
  console.log(texto_respuesta)
}
