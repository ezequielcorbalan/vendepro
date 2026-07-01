'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  KeyRound, Plus, Trash2, Loader2, ArrowLeft, Copy, Check,
  AlertCircle, ShieldAlert, Terminal, CheckCircle2, Radio,
} from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { API_SCOPES } from '@/lib/crm-config'
import type { ApiToken } from '@/lib/types'

const IMPORT_ENDPOINT = `${getApiBase('public')}/v1/leads`

// Construye el ejemplo de request. Si se pasa el token, queda listo para copiar/pegar.
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

export default function ConfiguracionApiPage() {
  const { toast } = useToast()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  // Token recién creado — se muestra UNA sola vez en claro
  const [newToken, setNewToken] = useState<{ id: string; name: string; token: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Tester en vivo: espera a que llegue el primer request con el token nuevo.
  const [testStatus, setTestStatus] = useState<'idle' | 'waiting' | 'done'>('idle')

  function loadTokens() {
    setLoading(true)
    setError(false)
    apiFetch('crm', '/api-tokens')
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setTokens(Array.isArray(d) ? d : [])
        setLoading(false)
      })
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
        setTestStatus('waiting')
        setShowCreate(false)
        setName('')
        loadTokens()
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

  // Tester en vivo: mientras esperamos, consultamos el token cada 3s. `last_used_at`
  // sólo se setea cuando un request autenticado llega al endpoint /v1/leads, así que
  // su aparición confirma que la integración funciona.
  useEffect(() => {
    if (testStatus !== 'waiting' || !newToken) return
    let cancelled = false
    const poll = setInterval(async () => {
      try {
        const res = await apiFetch('crm', '/api-tokens')
        const list = (await res.json()) as any
        const t = Array.isArray(list) ? list.find((x: any) => x.id === newToken.id) : null
        if (!cancelled && t?.last_used_at) {
          setTestStatus('done')
          setTokens(prev => prev.map(x => x.id === t.id ? { ...x, last_used_at: t.last_used_at } : x))
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 3000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [testStatus, newToken])

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

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
    <div className="max-w-3xl mx-auto space-y-6">
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

      {/* Token recién creado — visible una sola vez */}
      {newToken && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
          <p className="font-semibold text-amber-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Token “{newToken.name}” creado
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Guardalo ahora: por seguridad <strong>no vas a poder verlo de nuevo</strong>.
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

          {/* Ejemplo de request listo para copiar, con este token */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-sm font-medium text-amber-900">Probalo ahora</p>
              <button
                onClick={() => copyText(buildCurl(newToken.token), 'curl')}
                aria-label="Copiar comando de ejemplo"
                className="flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900"
              >
                {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'curl' ? 'Copiado' : 'Copiar comando'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs leading-relaxed">{buildCurl(newToken.token)}</pre>
            </div>
          </div>

          {/* Tester en vivo: espera el primer request */}
          <div aria-live="polite" className="mt-4">
            {testStatus === 'done' ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800">
                  <strong>¡Recibimos tu lead de prueba!</strong> La integración está funcionando.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                <Radio className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  Esperando tu primer lead de prueba… ejecutá el comando de arriba.
                </p>
                <Loader2 className="w-4 h-4 animate-spin text-amber-500 ml-auto shrink-0" />
              </div>
            )}
          </div>

          <button
            onClick={() => { setNewToken(null); setTestStatus('idle') }}
            className="text-xs text-amber-700 underline mt-3"
          >
            {testStatus === 'done' ? 'Listo, cerrar' : 'Ya lo guardé, ocultar'}
          </button>
        </div>
      )}

      {/* Lista de tokens */}
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
          <p className="text-sm text-gray-500 mt-1">Creá un token para conectar una integración que importe leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map(token => (
            <div key={token.id} className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-800 truncate">{token.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    token.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {token.is_active ? 'Activo' : 'Revocado'}
                  </span>
                  {token.scopes?.map(s => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-brand-pink">
                      {API_SCOPES[s as keyof typeof API_SCOPES]?.label ?? s}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono truncate">{token.prefix}</p>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  Creado {fmtDate(token.created_at)} · Último uso {fmtDate(token.last_used_at)}
                </p>
              </div>
              {token.is_active && (
                <button
                  onClick={() => handleRevoke(token.id, token.name)}
                  title="Revocar token"
                  aria-label={`Revocar token ${token.name}`}
                  className="shrink-0 flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Documentación del endpoint */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brand-pink" /> Cómo importar leads
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Enviá un <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST</code> con el token en el header
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded ml-1">Authorization: Bearer</code>.
          Acepta un lead o varios (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{ "leads": [...] }'}</code>, hasta 100).
          Los leads entran sin asignar, en estado <strong>Nuevo</strong>.
        </p>
        <div className="relative overflow-x-auto">
          <button
            onClick={() => copyText(buildCurl(), 'curl-docs')}
            aria-label="Copiar comando de ejemplo"
            className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/10 text-gray-200 hover:bg-white/20 rounded-md px-2 py-1 text-xs"
          >
            {copiedKey === 'curl-docs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'curl-docs' ? 'Copiado' : 'Copiar'}
          </button>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 pt-10 text-xs leading-relaxed">{buildCurl()}</pre>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Campos: <code className="font-mono">full_name</code> (requerido), <code className="font-mono">phone</code>,{' '}
          <code className="font-mono">email</code>, <code className="font-mono">operation</code>,{' '}
          <code className="font-mono">source_detail</code>, <code className="font-mono">notes</code>.
        </p>
      </div>

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
