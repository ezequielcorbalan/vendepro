// HTTP client + shared tracker for the production state-machine smoke.
//
// All test files share a single tracker (`created`) so that the global
// afterAll() hook can delete every entity created during the run,
// regardless of which test created it.

const BASES = {
  auth:  process.env.SMOKE_BASE_AUTH  || 'https://auth.api.vendepro.com.ar',
  crm:   process.env.SMOKE_BASE_CRM   || 'https://crm.api.vendepro.com.ar',
  props: process.env.SMOKE_BASE_PROPS || 'https://properties.api.vendepro.com.ar',
} as const

export type Base = keyof typeof BASES

export interface Response<T = any> {
  status: number
  data: T
}

let token: string | null = null

export async function req<T = any>(
  method: string,
  base: Base,
  path: string,
  body?: unknown,
): Promise<Response<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(`${BASES[base]}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let data: any
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data }
}

export async function login(): Promise<{ email: string; orgId: string; role: string }> {
  const email = process.env.SMOKE_EMAIL
  const password = process.env.SMOKE_PASSWORD
  if (!email || !password) throw new Error('Missing SMOKE_EMAIL / SMOKE_PASSWORD env vars')

  const r = await req<any>('POST', 'auth', '/login', { email, password })
  if (r.status !== 200 || !r.data?.token) {
    throw new Error(`Login failed: status=${r.status} body=${JSON.stringify(r.data).slice(0, 200)}`)
  }
  token = r.data.token
  return { email: r.data.user.email, orgId: r.data.user.org_id, role: r.data.user.role }
}

export const created = {
  leads: [] as string[],
  properties: [] as string[],
  events: [] as string[],
  contacts: [] as string[],
}

export const SMOKE_RUN_ID = Date.now()
// Todo lo que crea el smoke lleva este prefijo en el full_name. El barrido
// (sweepStaleSmokeArtifacts) lo usa para encontrar y limpiar fugas de runs viejos.
export const TAG_PREFIX = 'SMOKE TEST'
export const tag = (label: string) => `${TAG_PREFIX} ${label} ${SMOKE_RUN_ID}`

export async function createLead(label: string, opts: { stage?: string } = {}): Promise<string> {
  const name = tag(label)
  const r = await req<any>('POST', 'crm', '/leads', {
    full_name: name,
    contact_data: {
      full_name: name,
      phone: '+5491100000001',
      email: `smoke-${label.toLowerCase()}-${SMOKE_RUN_ID}@test.local`,
    },
    source: 'manual',
    operation: 'venta',
  })
  if ((r.status !== 200 && r.status !== 201) || !r.data?.id) {
    throw new Error(`createLead failed: status=${r.status} body=${JSON.stringify(r.data)}`)
  }
  created.leads.push(r.data.id)
  if (r.data.contact_id) created.contacts.push(r.data.contact_id)
  if (opts.stage && opts.stage !== 'nuevo') {
    // walk through manual chain to reach the desired starting stage
    const chain = chainFromNuevo(opts.stage)
    for (const s of chain) {
      // Regla de negocio: no se puede pasar a 'captado' sin una propiedad
      // vinculada. La creamos ya en 'captada' (la sync captado→property solo
      // toca propiedades en 'propuesta', así que no interfiere).
      if (s === 'captado') {
        await createProperty({ leadId: r.data.id, stage: 'captada' })
      }
      const rs = await req<any>('POST', 'crm', '/leads/stage', { id: r.data.id, stage: s })
      if (rs.status !== 200) {
        throw new Error(`createLead reaching ${opts.stage} failed at ${s}: ${JSON.stringify(rs.data)}`)
      }
      if (s === 'presentada') await trackFollowupEvent(r.data.id)
    }
  }
  return r.data.id
}

/**
 * Busca el evento de seguimiento que la automatización `seguimiento_presentada`
 * crea al pasar el lead a "presentada".
 *
 * Antes venía en la respuesta de la API (`autoFollowup`); ahora lo crea el
 * motor de automatizaciones de forma asíncrona, así que hay que buscarlo y
 * reintentar. Es best-effort y sólo sirve para poder limpiarlo después: si la
 * org tiene la automatización apagada, no existe y no es un error.
 */
export async function findFollowupEventId(leadId: string, attempts = 5): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const r = await req<any[]>('GET', 'crm', '/calendar?event_type=seguimiento')
    if (r.status === 200 && Array.isArray(r.data)) {
      const match = r.data.find((e) => e?.lead_id === leadId)
      if (match?.id) return match.id as string
    }
    // Backoff corto: el drenaje inline suele resolver en el primer reintento.
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)))
  }
  return null
}

/** Registra el evento de seguimiento para que el cleanup no deje huérfanos. */
export async function trackFollowupEvent(leadId: string): Promise<void> {
  const id = await findFollowupEventId(leadId)
  if (id && !created.events.includes(id)) created.events.push(id)
}

export async function createProperty(opts: { leadId?: string | null; stage?: string } = {}): Promise<string> {
  const r = await req<any>('POST', 'props', '/properties', {
    address: tag('property'),
    neighborhood: 'Smoke',
    city: 'CABA',
    property_type: 'departamento',
    owner_name: 'Smoke Owner',
    owner_phone: '+5491100000099',
    asking_price: 100000,
    currency: 'USD',
    lead_id: opts.leadId ?? null,
  })
  if ((r.status !== 200 && r.status !== 201) || !r.data?.id) {
    throw new Error(`createProperty failed: status=${r.status} body=${JSON.stringify(r.data)}`)
  }
  created.properties.push(r.data.id)
  if (opts.stage) {
    // 'propuesta' is the implicit default for new properties (commercial_stage=null
    // is treated as propuesta by the state machine), but PUT /properties/:id/stage
    // refuses propuesta→propuesta. To persist propuesta explicitly (so the sync
    // engine sees it as non-null), bypass the state-machine endpoint and write the
    // field directly via PUT /properties/:id.
    if (opts.stage === 'propuesta') {
      await setPropertyFieldRaw(r.data.id, { commercial_stage: 'propuesta' })
    } else {
      await setPropertyStage(r.data.id, opts.stage)
    }
  }
  return r.data.id
}

export async function setPropertyStage(id: string, stage: string): Promise<void> {
  const r = await req<any>('PUT', 'props', `/properties/${id}/stage`, { commercial_stage: stage })
  if (r.status !== 200) throw new Error(`setPropertyStage ${stage} failed: ${JSON.stringify(r.data)}`)
}

async function setPropertyFieldRaw(id: string, patch: Record<string, unknown>): Promise<void> {
  const r = await req<any>('PUT', 'props', `/properties/${id}`, patch)
  if (r.status !== 200) throw new Error(`setPropertyFieldRaw failed: ${JSON.stringify(r.data)}`)
}

export async function advanceLeadStage(
  id: string,
  stage: string,
): Promise<{ status: number; data: any }> {
  const r = await req<any>('POST', 'crm', '/leads/stage', { id, stage })
  // El seguimiento ya no viene en la respuesta: lo crea la automatización.
  if (r.status === 200 && stage === 'presentada') await trackFollowupEvent(id)
  return r
}

export async function getProperty(id: string): Promise<any> {
  const r = await req<any>('GET', 'props', `/properties/${id}`)
  return r.data
}

export async function getStageHistory(entity_type: 'lead' | 'property', entity_id: string): Promise<any[]> {
  const r = await req<any>('GET', 'crm', `/stage-history?entity_type=${entity_type}&entity_id=${entity_id}`)
  return Array.isArray(r.data) ? r.data : []
}

// api-crm exposes GET /leads (list) but no GET /leads/:id, so derive the current
// stage from the append-only stage_history (latest to_stage). If no history rows
// exist, the lead has never transitioned and is still at its initial stage 'nuevo'.
export async function getLeadStage(id: string): Promise<string> {
  const history = await getStageHistory('lead', id)
  if (history.length === 0) return 'nuevo'
  // findByEntity returns rows ordered DESC by changed_at (verified empirically in Block A).
  return history[0].to_stage
}

// Polls getLeadStage until it matches `expected` or the timeout expires.
// Absorbs Cloudflare D1's eventual consistency between primary write and read
// replica — visible from GitHub Actions runners (~1s lag is normal).
export async function expectLeadStage(
  id: string,
  expected: string,
  timeoutMs = 8_000,
  intervalMs = 400,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let last = await getLeadStage(id)
  while (last !== expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await getLeadStage(id)
  }
  return last
}

export async function expectPropertyStage(
  id: string,
  expected: string,
  timeoutMs = 8_000,
  intervalMs = 400,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  let last = (await getProperty(id))?.commercial_stage ?? null
  while (last !== expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    last = (await getProperty(id))?.commercial_stage ?? null
  }
  return last
}

export async function cleanup(): Promise<{ events: number; props: number; leads: number; contacts: number }> {
  // Order matters: events → properties → leads → contacts to respect FKs.
  const counts = { events: 0, props: 0, leads: 0, contacts: 0 }
  for (const id of created.events) {
    const r = await req('DELETE', 'crm', `/calendar?id=${id}`)
    if (r.status === 200) counts.events++
    else console.warn(`[cleanup] event ${id}: ${r.status}`)
  }
  for (const id of created.properties) {
    const r = await req('DELETE', 'props', `/properties/${id}`)
    if (r.status === 200) counts.props++
    else console.warn(`[cleanup] property ${id}: ${r.status}`)
  }
  for (const id of created.leads) {
    const r = await req('DELETE', 'crm', `/leads?id=${id}`)
    if (r.status === 200) counts.leads++
    else console.warn(`[cleanup] lead ${id}: ${r.status}`)
  }
  for (const id of created.contacts) {
    const r = await req('DELETE', 'crm', `/contacts?id=${id}`)
    if (r.status === 200) counts.contacts++
    else console.warn(`[cleanup] contact ${id}: ${r.status}`)
  }
  return counts
}

// created_at viene de datetime('now') en UTC ("YYYY-MM-DD HH:MM:SS", sin zona).
// Lo normalizamos a ISO-UTC para parsear consistente en cualquier runner.
function ageMs(createdAt: unknown): number {
  if (typeof createdAt !== 'string' || !createdAt) return 0
  const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Date.now() - t : 0
}

// Red de seguridad auto-sanante: borra leads/contactos con tag `SMOKE TEST` que
// hayan quedado huérfanos de runs anteriores (cuando el proceso murió por
// "worker exceeded resource limits" antes de correr afterAll, o un assert cortó
// antes de trackear la entidad).
//
// SEGURIDAD ANTE CONCURRENCIA: las 8 APIs deployan en paralelo y comparten la
// misma DB de prod. Por eso SOLO borramos filas con más de `maxAgeMs` de vida:
// los leads de un run concurrente tienen segundos, nunca se tocan. Además hay
// tope de tiempo (`budgetMs`) y de borrados (`maxDeletes`) para no saturar el
// worker cuando el backlog es grande — el resto drena en runs siguientes.
export async function sweepStaleSmokeArtifacts(
  { maxAgeMs = 3_600_000, budgetMs = 45_000, maxDeletes = 200 } = {},
): Promise<{ leads: number; contacts: number; capped: boolean }> {
  const deadline = Date.now() + budgetMs
  const q = encodeURIComponent(TAG_PREFIX)
  const result = { leads: 0, contacts: 0, capped: false }

  const sweep = async (kind: 'leads' | 'contacts') => {
    // La lista topea en 500; iteramos hasta que no queden viejos o toquemos un límite.
    for (let guard = 0; guard < 20; guard++) {
      if (Date.now() > deadline || result.leads + result.contacts >= maxDeletes) {
        result.capped = true
        return
      }
      const r = await req<any[]>('GET', 'crm', `/${kind}?search=${q}`)
      const rows = Array.isArray(r.data) ? r.data : []
      const stale = rows.filter(
        (x) => typeof x?.full_name === 'string' && x.full_name.startsWith(TAG_PREFIX) && ageMs(x.created_at) > maxAgeMs,
      )
      if (stale.length === 0) return
      for (const x of stale) {
        if (Date.now() > deadline || result.leads + result.contacts >= maxDeletes) {
          result.capped = true
          return
        }
        const d = await req('DELETE', 'crm', `/${kind}?id=${x.id}`)
        if (d.status === 200) result[kind]++
      }
    }
  }

  await sweep('leads')      // leads primero: al borrarlos se desvincula todo
  await sweep('contacts')   // contactos después (respeta la FK lead→contact)
  return result
}

// Manual chain to reach a lead stage from 'nuevo'. Matches MANUAL_TRANSITIONS.
function chainFromNuevo(target: string): string[] {
  const chain: Record<string, string[]> = {
    asignado:    ['asignado'],
    contactado:  ['asignado', 'contactado'],
    calificado:  ['asignado', 'contactado', 'calificado'],
    en_tasacion: ['asignado', 'contactado', 'calificado', 'en_tasacion'],
    presentada:  ['asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada'],
    seguimiento: ['asignado', 'contactado', 'seguimiento'],
    captado:     ['asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'captado'],
    invalido:    ['invalido'],
    perdido:     ['perdido'],
  }
  return chain[target] ?? []
}
