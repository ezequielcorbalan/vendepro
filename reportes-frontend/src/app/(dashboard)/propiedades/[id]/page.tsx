'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, FileBarChart, CheckCircle2, Clock,
  Loader2, Pencil, Plus, Phone, MessageCircle, Home, DollarSign,
  FileText, TrendingUp, Trash2, X, Check
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  captada: { label: 'Captada', color: 'bg-blue-100 text-blue-700' },
  documentacion: { label: 'Documentación', color: 'bg-purple-100 text-purple-700' },
  publicada: { label: 'Publicada', color: 'bg-green-100 text-green-700' },
  reservada: { label: 'Reservada', color: 'bg-orange-100 text-orange-700' },
  vendida: { label: 'Vendida', color: 'bg-gray-100 text-gray-700' },
  suspendida: { label: 'Suspendida', color: 'bg-red-100 text-red-700' },
}

const STAGES = Object.keys(STAGE_LABELS)

function formatDate(str: string) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPrice(n: number, currency = 'USD') {
  if (!n) return '-'
  return `${currency} ${n.toLocaleString('es-AR')}`
}

export default function PropiedadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [property, setProperty] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [newPriceCurrency, setNewPriceCurrency] = useState('USD')
  const [savingPrice, setSavingPrice] = useState(false)
  const [changingStage, setChangingStage] = useState(false)

  async function load() {
    try {
      const res = await apiFetch('properties', `/properties?id=${id}`)
      const data = (await res.json()) as any
      if (data.error || !data.id) { router.push('/propiedades'); return }
      setProperty(data)
      setReports(data.reports || [])
      setPriceHistory(data.price_history || [])
    } catch { router.push('/propiedades') }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleStageChange(newStage: string) {
    if (!property || changingStage) return
    setChangingStage(true)
    try {
      const res = await apiFetch('properties', '/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage: newStage }),
      })
      const data = (await res.json()) as any
      if (data.success) {
        setProperty((p: any) => ({ ...p, stage: newStage }))
        toast(`Estado cambiado a ${STAGE_LABELS[newStage]?.label || newStage}`)
      } else {
        toast(data.error || 'Error al cambiar estado', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setChangingStage(false)
  }

  async function handlePriceUpdate() {
    if (!newPrice) return
    setSavingPrice(true)
    try {
      const res = await apiFetch('properties', '/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, asking_price: Number(newPrice), currency: newPriceCurrency }),
      })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Precio actualizado')
        setEditingPrice(false)
        setNewPrice('')
        load()
      } else {
        toast(data.error || 'Error al actualizar precio', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSavingPrice(false)
  }

  async function handleDeleteReport(reportId: string) {
    if (!confirm('¿Eliminar este reporte?')) return
    try {
      const res = await apiFetch('properties', `/reports?id=${reportId}`, { method: 'DELETE' })
      const data = (await res.json()) as any
      if (data.success) {
        setReports(r => r.filter(rp => rp.id !== reportId))
        toast('Reporte eliminado')
      } else {
        toast(data.error || 'Error al eliminar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  if (!property) return null

  const p = property
  const stageInfo = STAGE_LABELS[p.stage] || { label: p.stage, color: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stageInfo.color}`}>
                {stageInfo.label}
              </span>
              <span className="text-xs text-gray-400 capitalize">{p.property_type}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 truncate">{p.address}</h1>
            <p className="text-gray-500 text-sm">{p.neighborhood}, {p.city}</p>
            {p.size_m2 && <p className="text-xs text-gray-400 mt-1">{p.rooms && `${p.rooms} amb · `}{p.size_m2} m²</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-[#ff007c]">{formatPrice(p.asking_price, p.currency)}</p>
              {p.size_m2 && p.asking_price && (
                <p className="text-xs text-gray-400">
                  {Math.round(p.asking_price / p.size_m2).toLocaleString('es-AR')} {p.currency}/m²
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingPrice(true); setNewPrice(p.asking_price?.toString() || ''); setNewPriceCurrency(p.currency || 'USD') }}
                className="text-xs text-gray-500 hover:text-gray-700 border rounded-lg px-2 py-1"
              >
                <Pencil className="w-3 h-3 inline mr-1" />Cambiar precio
              </button>
              {p.public_slug && (
                <a
                  href={`/r/${p.public_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90"
                >
                  <ExternalLink className="w-3 h-3" /> Ver reporte
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Price edit inline */}
        {editingPrice && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border">
            <p className="text-sm font-medium text-gray-700 mb-3">Nuevo precio</p>
            <div className="flex items-center gap-2">
              <select
                value={newPriceCurrency}
                onChange={e => setNewPriceCurrency(e.target.value)}
                className="border rounded-lg px-2 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="Nuevo precio"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
              />
              <button
                onClick={handlePriceUpdate}
                disabled={savingPrice}
                className="bg-[#ff007c] text-white px-3 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
              >
                {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditingPrice(false)} className="p-2 rounded-lg hover:bg-gray-200">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Owner info */}
        {p.owner_name && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{p.owner_name}</span>
            </div>
            {p.owner_phone && (
              <div className="flex items-center gap-2">
                <a href={`tel:${p.owner_phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {p.owner_phone}
                </a>
                <a
                  href={`https://wa.me/${p.owner_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            )}
            {p.owner_email && (
              <a href={`mailto:${p.owner_email}`} className="text-sm text-gray-500 hover:underline">{p.owner_email}</a>
            )}
          </div>
        )}
      </div>

      {/* Stage selector */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Estado de la propiedad</h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map(stage => {
            const s = STAGE_LABELS[stage]
            const isActive = p.stage === stage
            return (
              <button
                key={stage}
                onClick={() => !isActive && handleStageChange(stage)}
                disabled={changingStage || isActive}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${s.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {isActive && <Check className="w-3 h-3 inline mr-1" />}
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Price history + reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price history */}
        {priceHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#ff007c]" /> Historial de precios
            </h2>
            <div className="space-y-2">
              {priceHistory.map((ph: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{formatDate(ph.changed_at)}</span>
                  <span className="font-semibold text-gray-800">{formatPrice(ph.price, ph.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        <div className={`bg-white rounded-xl shadow-sm ${priceHistory.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Reportes</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{reports.length} reporte{reports.length !== 1 ? 's' : ''}</span>
              <Link
                href={`/propiedades/${id}/reportes/nuevo`}
                className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90"
              >
                <Plus className="w-3 h-3" /> Nuevo reporte
              </Link>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="p-12 text-center">
              <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">No hay reportes para esta propiedad</p>
              <Link href={`/propiedades/${id}/reportes/nuevo`} className="text-[#ff007c] text-sm font-medium hover:underline">
                Crear el primer reporte
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report: any) => (
                <div key={report.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      report.status === 'published' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {report.status === 'published'
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <Clock className="w-5 h-5 text-yellow-600" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{report.period_label}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(report.period_start)} - {formatDate(report.period_end)}
                        {report.creator_name && ` · por ${report.creator_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      report.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {report.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                    {report.public_slug && (
                      <a
                        href={`/r/${report.public_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Property details */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" /> Detalles de la propiedad
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Tipo</p>
            <p className="font-semibold text-sm text-gray-800 capitalize">{p.property_type || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Ambientes</p>
            <p className="font-semibold text-sm text-gray-800">{p.rooms || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Superficie</p>
            <p className="font-semibold text-sm text-gray-800">{p.size_m2 ? `${p.size_m2} m²` : '-'}</p>
          </div>
          <div className="bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Precio</p>
            <p className="font-bold text-sm text-[#ff007c]">{formatPrice(p.asking_price, p.currency)}</p>
          </div>
        </div>
        {p.description && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Descripción</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.description}</p>
          </div>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          {p.agent_name && <span>Agente: {p.agent_name}</span>}
          {p.created_at && <span>Captada: {formatDate(p.created_at)}</span>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/propiedades/${id}/reportes/nuevo`}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <FileBarChart className="w-4 h-4" /> Nuevo reporte
          </Link>
          <Link
            href={`/tasaciones/nueva?property_id=${id}`}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <DollarSign className="w-4 h-4" /> Nueva tasación
          </Link>
          {p.owner_phone && (
            <a
              href={`https://wa.me/${p.owner_phone.replace(/\D/g, '')}?text=Hola ${encodeURIComponent(p.owner_name || '')}, te contacto por la propiedad en ${encodeURIComponent(p.address || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp propietario
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
