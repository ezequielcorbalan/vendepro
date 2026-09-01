'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MessageCircle, Plus, Trash2, Pencil, Loader2, ArrowLeft,
  ShieldAlert, MessageSquareText,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import {
  WHATSAPP_TEMPLATE_VARIABLES,
  renderWhatsAppTemplate,
  invalidateWhatsAppTemplates,
  type WhatsAppTemplate,
} from '@/lib/whatsapp-templates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Switch } from '@/components/ui/Switch'

/** Contexto de ejemplo para que el admin vea cómo queda el mensaje real. */
const PREVIEW_CONTEXT = { name: 'Gustavo Monzón', address: 'Lavalle 2060' }

interface FormState {
  id: string | null
  name: string
  body: string
  is_active: boolean
}

const EMPTY_FORM: FormState = { id: null, name: '', body: '', is_active: true }

export default function ConfiguracionWhatsAppPage() {
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()

  // Igual que el resto de Configuración: el rol se resuelve en el efecto para
  // que el render del servidor (sin localStorage) coincida con el del cliente.
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleResolved, setRoleResolved] = useState(false)

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    apiFetch('crm', '/whatsapp-templates')
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setTemplates(Array.isArray(d?.templates) ? d.templates : [])
        setOrgName(d?.org_name ?? null)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  useEffect(() => {
    const role = getCurrentUser()?.role
    const admin = role === 'admin' || role === 'owner'
    setIsAdmin(admin)
    setRoleResolved(true)
    if (admin) load()
    else setLoading(false)
  }, [load])

  const openNew = () => { setForm(EMPTY_FORM); setShowForm(true) }
  const openEdit = (t: WhatsAppTemplate) => {
    setForm({ id: t.id, name: t.name, body: t.body, is_active: t.is_active === 1 })
    setShowForm(true)
  }

  const handleSave = async () => {
    const name = form.name.trim()
    const body = form.body.trim()
    if (!name || !body) { toast('Poné un nombre y un texto para el mensaje', 'error'); return }

    setSaving(true)
    try {
      const res = await apiFetch('crm', form.id ? `/whatsapp-templates/${form.id}` : '/whatsapp-templates', {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          body,
          is_active: form.is_active,
          // Los nuevos van al final de la lista del selector.
          ...(form.id ? {} : { sort_order: templates.length }),
        }),
      })
      const data = (await res.json()) as any
      if (data.error) toast(data.error, 'error')
      else {
        toast(form.id ? 'Mensaje actualizado' : 'Mensaje creado')
        setShowForm(false)
        setForm(EMPTY_FORM)
        invalidateWhatsAppTemplates()
        load()
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const handleDelete = async (t: WhatsAppTemplate) => {
    const { confirmed } = await askConfirm({
      title: 'Borrar mensaje',
      message: `“${t.name}” deja de aparecer en el selector de WhatsApp para todo el equipo.`,
      confirmLabel: 'Borrar',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await apiFetch('crm', `/whatsapp-templates/${t.id}`, { method: 'DELETE' })
      toast('Mensaje borrado')
      invalidateWhatsAppTemplates()
      load()
    } catch { toast('Error al borrar', 'error') }
  }

  const insertVariable = (key: string) => {
    setForm(f => ({ ...f, body: `${f.body}${f.body && !f.body.endsWith(' ') ? ' ' : ''}{{${key}}}` }))
  }

  if (!roleResolved) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <EmptyState
          icon={<ShieldAlert className="w-7 h-7" />}
          title="Acceso restringido"
          description="Sólo administradores pueden editar los mensajes predeterminados de la inmobiliaria."
          action={
            <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-primary">
              <ArrowLeft className="w-4 h-4" /> Volver a Configuración
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {confirmDialog}

      {/* Header propio (pantalla con back-nav) */}
      <div>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-ink flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-gray-600" /> Mensajes de WhatsApp
            </h1>
            <Text tone="muted" className="mt-1">
              Los textos que el equipo elige al tocar WhatsApp en un lead o contacto, sin tipear nada.
            </Text>
          </div>
          <Button onClick={openNew} icon={<Plus className="w-4 h-4" />} className="shrink-0">
            Nuevo mensaje
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="No se pudieron cargar los mensajes">
          Revisá la conexión y volvé a intentar.
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-full bg-gray-100 rounded mb-1.5" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="w-7 h-7" />}
          title="Todavía no hay mensajes"
          description="Cargá los textos que más repetís (primer contacto, seguimiento, coordinar visita) y el equipo los manda en dos clics."
          action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>Nuevo mensaje</Button>}
        />
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Heading level={4}>{t.name}</Heading>
                    {t.is_active !== 1 && <StatusBadge label="Desactivado" size="sm" />}
                  </div>
                  <Text size="sm" tone="muted" className="whitespace-pre-wrap">
                    {renderWhatsAppTemplate(t.body, PREVIEW_CONTEXT, { orgName })}
                  </Text>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(t)}>
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => handleDelete(t)}>
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-danger" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Alert tone="info" title="Cómo se ve la vista previa">
        Arriba los mensajes se muestran con datos de ejemplo. Al mandarlos, cada variable se reemplaza
        con los datos reales del lead o contacto.
      </Alert>

      {/* Alta / edición */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setForm(EMPTY_FORM) }}
        title={form.id ? 'Editar mensaje' : 'Nuevo mensaje'}
        icon={<MessageCircle className="w-4 h-4" />}
        className="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{form.id ? 'Guardar' : 'Crear'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre" hint="Sólo lo ve el equipo, para identificarlo en la lista." required>
            <Input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Primer contacto"
            />
          </Field>

          <Field label="Mensaje" required>
            <Textarea
              rows={5}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Hola {{nombre}}, te escribo de {{inmobiliaria}}…"
            />
          </Field>

          <div>
            <Text size="xs" tone="muted" className="mb-1.5">Insertar variable:</Text>
            <div className="flex flex-wrap gap-1.5">
              {WHATSAPP_TEMPLATE_VARIABLES.map(v => (
                <Button key={v.key} variant="outline" size="sm" onClick={() => insertVariable(v.key)} title={v.label}>
                  {`{{${v.key}}}`}
                </Button>
              ))}
            </div>
          </div>

          {form.body.trim() && (
            <div className="p-3 rounded-card bg-gray-50 border border-gray-100">
              <Text size="xs" tone="muted" className="mb-1">Vista previa</Text>
              <Text size="sm" className="whitespace-pre-wrap">
                {renderWhatsAppTemplate(form.body, PREVIEW_CONTEXT, { orgName })}
              </Text>
            </div>
          )}

          <Switch
            checked={form.is_active}
            onChange={v => setForm(f => ({ ...f, is_active: v }))}
            label="Disponible en el selector de WhatsApp"
          />
        </div>
      </Modal>
    </div>
  )
}
