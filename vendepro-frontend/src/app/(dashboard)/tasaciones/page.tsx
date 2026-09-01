'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ClipboardList, MapPin, ExternalLink, Pencil, Trash2, Database, Download, Loader2, Settings } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { scopeQueryString } from '@/lib/agent-scope'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { generatePdf } from '@/components/tasaciones/shared/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Heading, Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getAppraisalStatus } from '@/lib/crm-config'
import { FichaLinkSection } from '@/components/fichas/FichaLinkSection'

import { Button } from '@/components/ui/Button'
export default function TasacionesPage() {
  const { toast } = useToast()
  const [appraisals, setAppraisals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState<Set<string>>(new Set())

  function loadAppraisals() {
    const scope = scopeQueryString()
    apiFetch('properties', `/appraisals${scope}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setAppraisals(Array.isArray(d) ? d : (d.appraisals || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadAppraisals() }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tasación?')) return
    try {
      await apiFetch('properties', `/appraisals?id=${id}`, { method: 'DELETE' })
      toast('Tasación eliminada', 'warning')
      loadAppraisals()
    } catch { toast('Error al eliminar', 'error') }
  }

  async function handleDownloadPdf(id: string) {
    setPdfLoading(prev => new Set(prev).add(id))
    try {
      const result = await generatePdf(id)
      window.open(result.pdf_url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      if (e.code === 'quota_exceeded') {
        toast(`Alcanzaste el límite de ${e.details?.limit ?? '—'} PDFs este mes`, 'error')
      } else {
        toast('Error al generar el PDF', 'error')
      }
    } finally {
      setPdfLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Tasaciones"
        subtitle="Tasaciones profesionales para propietarios"
        actions={
          <>
            <Button href="/configuracion/tasacion" variant="outline" icon={<Settings className="w-4 h-4" />}>
              Configurar
            </Button>
            <Button href="/tasaciones/vendidas" variant="outline" icon={<Database className="w-4 h-4" />}>
              Cierres reales
            </Button>
            <Button href="/prefactibilidades/nueva" variant="outline" icon={<Plus className="w-4 h-4" />}>
              Prefactibilidad
            </Button>
            <Button href="/tasaciones/nueva" icon={<Plus className="w-4 h-4" />}>
              Nueva tasación
            </Button>
          </>
        }
      />

      <FichaLinkSection mode="open" className="mb-6" />

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-card" />)}
        </div>
      ) : appraisals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title="Sin tasaciones"
            description="Creá tu primera tasación"
            action={
              <Link href="/tasaciones/nueva" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-control text-sm font-medium hover:bg-primary-hover">
                <Plus className="w-4 h-4" /> Crear tasación
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {appraisals.map((a: any) => {
            const st = getAppraisalStatus(a.status)
            return (
              <Card key={a.id} padded={false} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link href={`/tasaciones/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Heading level={4} className="truncate">{a.property_address}</Heading>
                    <StatusBadge label={st.label} color={st.color} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.neighborhood}</span>
                    {a.suggested_price && <span className="font-medium text-primary">USD {Number(a.suggested_price).toLocaleString('es-AR')}</span>}
                    <span>{formatDate(a.created_at)}</span>
                  </div>
                  {a.agent_name && <Text size="xs" className="text-gray-400 mt-1">Agente: {a.agent_name}</Text>}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {a.public_slug && (
                    <a href={`/t/${a.public_slug}`} target="_blank" rel="noreferrer"
                      className="p-2 border rounded-control hover:bg-gray-50 text-gray-500" title="Ver pública">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDownloadPdf(a.id)}
                    disabled={pdfLoading.has(a.id)}
                    className="p-2 border rounded-control hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-wait"
                    title="Descargar PDF"
                  >
                    {pdfLoading.has(a.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <Link href={`/tasaciones/${a.id}`} className="p-2 border rounded-control hover:bg-gray-50 text-gray-500" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleDelete(a.id)} className="p-2 border rounded-control hover:bg-danger/5 hover:border-danger/30 text-gray-400 hover:text-danger" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
