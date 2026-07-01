'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  KeyRound, Plus, Trash2, Loader2, ArrowLeft, Copy, Check,
  AlertCircle, ShieldAlert, Terminal, CheckCircle2, Radio, Play, RotateCcw,
} from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { API_SCOPES } from '@/lib/crm-config'
import type { ApiToken } from '@/lib/types'

const IMPORT_ENDPOINT = `${getApiBase('public')}/v1/leads`

// Ejemplo de request. Con el token real queda listo para copiar/pegar.
function buildCurl(token = '<TU_TOKEN>'): string {
  return `curl -X POST ${IMPORT_ENDPOINT} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "full_name": "Juan Pérez",
    "phone": "+54 9 11 5555-5555",
    "email": "juan@example.com",
    "operation": "venta",
    "source_detail": "Prueba desde Configuración de API",
    "notes": "Lead de prueba"
  }'`
}

// El JWT de integración lleva el id del token (tid) en su payload, así podemos
// saber qué token vigilar en la prueba en vivo aunque el usuario lo pegue.
function decodeTid(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const json = JSON.parse(atob(b64 + pad))
    return typeof json.tid === 'string' ? json.tid : null
  } catch {
    return null
  }
}

type Tab = 'tokens' | 'test'

export default function ConfiguracionApiPage() {
  const { toast } = useToast()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [tab, setTab] = useState<Tab>('tokens')

  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  // Token recién creado — se muestra UNA sola vez en claro
  const [newToken, setNewToken] = useState<{ id: string; name: string; token: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Prueba en vivo
  const [testToken, setTestToken] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'waiting' | 'done'>('idle')
  const [testBaseline, setTestBaseline] = useState<string | null>(null)

  function loadTokens() {
    setLoading(true)
    setError(false)
    apiFetch('crm', '/api-tokens')
      .then(r => r.json() as Promise<any>)
      .then(d => { setTokens(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (name.trim().length < 2) return
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/api-tokens', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = (await res.json()) as any
      if (data.token) {
        setNewToken({ id: data.id, name: data.name, token: data.token })
        setShowCreate(false)
        setName('')
        loadTokens()
        // Deja el token cargado en la prueba en vivo y salta a esa pestaña.
        setTestToken(data.token)
        setTestBaseline(null)
        setTestStatus('waiting')
        setTab('test')
      } else {
        toast(data.error || 'No se pudo crear el token', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  async function handleRevoke(id: string, tokenName: string) {
    if (!confirm(`¿Revocar el token "${tokenName}"? Las integraciones que lo usen dejarán de funcionar.`)) return
    try {
      await apiFetch('crm', `/api-tokens/${id}`, { method: 'DELETE' })
      toast('Token revocado', 'warning')
      setTokens(prev => prev.map(t => t.id === id ? { ...t, is_active: false } : t))
    } catch {
      toast('Error al revocar', 'error')
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  async function startTest() {
    const tid = decodeTid(testToken.trim())
    if (!tid) { toast('Pegá un token de integración válido', 'error'); return }
    // baseline: último uso actual, para detectar el próximo request.
    let baseline: string | null = null
    try {
      const res = await apiFetch('crm', '/api-tokens')
      const list = (await res.json()) as any
      const t = Array.isArray(list) ? list.find((x: any) => x.id === tid) : null
      baseline = t?.last_used_at ?? null
    } catch { /* seguimos con baseline null */ }
    setTestBaseline(baseline)
    setTestStatus('waiting')
  }

  // Polling: `last_used_at` sólo cambia cuando un request autenticado llega a
  // /v1/leads, así que su cambio respecto al baseline confirma la prueba.
  useEffect(() => {
    if (testStatus !== 'waiting') return
    const tid = decodeTid(testToken.trim())
    if (!tid) return
    let cancelled = false
    const poll = setInterval(async () => {
      try {
        const res = await apiFetch('crm', '/api-tokens')
        const list = (await res.json()) as any
        const t = Array.isArray(list) ? list.find((x: any) => x.id === tid) : null
        if (!cancelled && t?.last_used_at && t.last_used_at !== testBaseline) {
          setTestStatus('done')
          setTokens(prev => prev.map(x => x.id === tid ? { ...x, last_used_at: t.last_used_at } : x))
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 3000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [testStatus, testToken, testBaseline])

  const fmtDate = (s: string | null) =>
    s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  const activeCount = tokens.filter(t => t.is_active).length

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-800 font-medium">Acceso restringido</p>
        <p className="text-sm text-gray-500 mt-1">Sólo administradores pueden gestionar tokens de API.</p>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-brand-pink mt-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-brand-pink" /> Configuración de API
            </h1>
            <p className="text-gray-500 text-sm mt-1">Tokens para importar leads desde sistemas externos.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nuevo token
          </button>
        </div>
      </div>

      {/* Token recién creado — visible una sola vez, por encima de las tabs */}
      {newToken && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
          <p className="font-semibold text-amber-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Token “{newToken.name}” creado
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Copialo ahora: por seguridad <strong>no vas a poder verlo de nuevo</strong>. Ya lo dejamos cargado en <em>Prueba en vivo</em>.
          </p>
          <div className="mt-3 flex items-stretch gap-2">
            <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">
              {newToken.token}
            </code>
            <button
              onClick={() => copyText(newToken.token, 'token')}
              aria-label="Copiar token al portapapeles"
              className="shrink-0 flex items-center gap-1.5 bg-amber-600 text-white px-3 rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              {copiedKey === 'token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedKey === 'token' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="text-xs text-amber-700 underline mt-3"
          >
            Ya lo guardé, ocultar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Secciones de API" className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'tokens' as Tab, label: 'Tokens', icon: KeyRound, badge: activeCount || null },
          { key: 'test' as Tab, label: 'Prueba en vivo', icon: Radio, badge: null },
        ]).map(t => {
          const active = tab === t.key
          const Icon = t.icon
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand-pink text-brand-pink'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.badge != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-pink-100 text-brand-pink' : 'bg-gray-100 text-gray-500'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB: TOKENS (grilla) ─────────────────────────────── */}
      {tab === 'tokens' && (
        <div role="tabpanel">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : error ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No se pudieron cargar los tokens.</p>
              <button onClick={loadTokens} className="text-sm text-brand-pink mt-2">Reintentar</button>
            </div>
          ) : tokens.length === 0 ? (
            <div className="bg-white rounded-xl border p-10 text-center">
              <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Todavía no hay tokens</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Creá un token para conectar una integración que importe leads.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Nuevo token
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tokens.map(token => (
                <div
                  key={token.id}
                  className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${token.is_active ? '' : 'opacity-70'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${token.is_active ? 'bg-pink-50 text-brand-pink' : 'bg-gray-100 text-gray-400'}`}>
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <p className="font-medium text-gray-800 truncate">{token.name}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      token.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {token.is_active ? 'Activo' : 'Revocado'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {token.scopes?.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-brand-pink">
                        {API_SCOPES[s as keyof typeof API_SCOPES]?.label ?? s}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 font-mono truncate">{token.prefix}</p>

                  <div className="flex items-end justify-between gap-2 mt-auto pt-1 border-t border-gray-100">
                    <p className="text-xs text-gray-500 tabular-nums leading-relaxed">
                      Creado {fmtDate(token.created_at)}<br />
                      Último uso {fmtDate(token.last_used_at)}
                    </p>
                    {token.is_active && (
                      <button
                        onClick={() => handleRevoke(token.id, token.name)}
                        title="Revocar token"
                        aria-label={`Revocar token ${token.name}`}
                        className="shrink-0 flex items-center justify-center w-11 h-11 -mr-1 -mb-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PRUEBA EN VIVO ──────────────────────────────── */}
      {tab === 'test' && (
        <div role="tabpanel" className="space-y-5">
          {/* Paso 1: token */}
          <div className="bg-white rounded-xl border p-5">
            <p className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-brand-pink text-white text-xs flex items-center justify-center">1</span>
              Tu token
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Pegá el token de integración que querés probar. Si acabás de crear uno, ya está cargado.
            </p>
            <textarea
              value={testToken}
              onChange={e => { setTestToken(e.target.value); setTestStatus('idle') }}
              placeholder="eyJhbGciOi..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          {/* Paso 2: request de ejemplo */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-pink text-white text-xs flex items-center justify-center">2</span>
                Hacé el request
              </p>
              <button
                onClick={() => copyText(buildCurl(testToken.trim() || undefined), 'curl')}
                aria-label="Copiar comando de ejemplo"
                className="flex items-center gap-1.5 text-xs font-medium text-brand-pink hover:opacity-80"
              >
                {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'curl' ? 'Copiado' : 'Copiar comando'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Acepta un lead o varios (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{ "leads": [...] }'}</code>, hasta 100).
              Entran sin asignar, en estado <strong>Nuevo</strong>.
            </p>
            <div className="overflow-x-auto">
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs leading-relaxed">{buildCurl(testToken.trim() || undefined)}</pre>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Campos: <code className="font-mono">full_name</code> (requerido), <code className="font-mono">phone</code>,{' '}
              <code className="font-mono">email</code>, <code className="font-mono">operation</code>,{' '}
              <code className="font-mono">source_detail</code>, <code className="font-mono">notes</code>.
            </p>
          </div>

          {/* Paso 3: escuchar en vivo */}
          <div className="bg-white rounded-xl border p-5">
            <p className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-brand-pink text-white text-xs flex items-center justify-center">3</span>
              Prueba en vivo
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Iniciá la escucha y ejecutá el comando. Vamos a detectar el primer request que llegue con este token.
            </p>

            <div aria-live="polite">
              {testStatus === 'idle' && (
                <button
                  onClick={startTest}
                  disabled={!testToken.trim()}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
                >
                  <Play className="w-4 h-4" /> Empezar prueba
                </button>
              )}

              {testStatus === 'waiting' && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </span>
                  <p className="text-sm text-amber-800 flex-1">
                    Escuchando… ejecutá el comando de arriba para enviar tu lead de prueba.
                  </p>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                  <button
                    onClick={() => setTestStatus('idle')}
                    className="text-xs text-amber-700 underline shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {testStatus === 'done' && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800 flex-1">
                    <strong>¡Recibimos tu lead de prueba!</strong> La integración está funcionando. Aparece en <strong>Leads</strong>, sin asignar.
                  </p>
                  <button
                    onClick={() => { setTestBaseline(null); setTestStatus('idle') }}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:opacity-80 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Probar de nuevo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-token-title"
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setShowCreate(false) }}
          >
            <h3 id="new-token-title" className="font-semibold text-gray-800 mb-1">Nuevo token de API</h3>
            <p className="text-sm text-gray-500 mb-4">Poné un nombre que te ayude a reconocer la integración.</p>
            <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-brand-pink">*</span>
            </label>
            <input
              id="token-name"
              autoFocus
              placeholder="Ej: Zapier, Landing propia, Portal X"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-pink-50 text-brand-pink">Importar leads</span>
              <span>Permiso incluido</span>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={name.trim().length < 2 || saving}
                className="flex-1 bg-brand-pink text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Creando...' : 'Crear token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
