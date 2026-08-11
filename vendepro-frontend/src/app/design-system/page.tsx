'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Search, Car, Sun, Waves, Inbox, AlertTriangle,
  MoreVertical, Pencil, Copy, RefreshCw, HelpCircle, Settings, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Textarea, Select, Field } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { StageBadge } from '@/components/ui/StageBadge'
import { EventChip } from '@/components/ui/EventChip'
import { Tabs } from '@/components/ui/Tabs'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Checkbox, RadioGroup } from '@/components/ui/Choice'
import { Tag } from '@/components/ui/Tag'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Tooltip } from '@/components/ui/Tooltip'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown'
import { Table, type Column } from '@/components/ui/Table'
import { Drawer } from '@/components/ui/Drawer'
import { Timeline } from '@/components/ui/Timeline'
import { ProgressBar, Steps } from '@/components/ui/Progress'
import { Heading, Text } from '@/components/ui/Typography'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import { NotificationBell, NotificationPanel } from '@/components/ui/Notifications'
import { KanbanBoard, KanbanColumn, KanbanCard } from '@/components/ui/Kanban'
import { PropertyCard } from '@/components/ui/PropertyCard'
import { BarChart, DonutChart, Funnel } from '@/components/ui/Charts'
import { LEAD_STAGE_KEYS, EVENT_TYPES, getStageDot, type EventType } from '@/lib/crm-config'

/**
 * Galería viva del design system de VendéPro.
 * Renderiza los componentes reales de src/components/ui. Al editar un token
 * (globals.css) o un componente, este muestrario y toda la app se actualizan.
 *
 * Ruta pública (ver middleware PUBLIC_PATHS). Es referencia interna sin datos.
 */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="py-8 border-b border-gray-200 last:border-0">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-ink tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

const SWATCHES = [
  { name: 'primary', cls: 'bg-primary', hex: '#ff007c → token' },
  { name: 'brand-pink', cls: 'bg-brand-pink', hex: '#ff007c' },
  { name: 'brand-pink-hover', cls: 'bg-brand-pink-hover', hex: '#e0006e' },
  { name: 'brand-orange', cls: 'bg-brand-orange', hex: '#ff8017' },
  { name: 'brand-orange-hover', cls: 'bg-brand-orange-hover', hex: '#e6720f' },
  { name: 'ink', cls: 'bg-ink', hex: '#27272a' },
  { name: 'brand-gray', cls: 'bg-brand-gray', hex: '#6b7280' },
]

const SEMANTIC_SWATCHES = [
  { name: 'success', var: '--color-success', hex: 'emerald 600' },
  { name: 'warning', var: '--color-warning', hex: 'amber 700' },
  { name: 'danger', var: '--color-danger', hex: 'red 600 · alerta' },
  { name: 'info', var: '--color-info', hex: 'blue 600' },
  { name: 'neutral', var: '--color-neutral', hex: 'brand-gray' },
]

// Clases literales (no `bg-${name}` dinámico) para que Tailwind v4 las genere.
const PALETTE_SWATCHES: { name: string; cls: string }[] = [
  { name: 'blue', cls: 'bg-blue' },
  { name: 'indigo', cls: 'bg-indigo' },
  { name: 'cyan', cls: 'bg-cyan' },
  { name: 'teal', cls: 'bg-teal' },
  { name: 'emerald', cls: 'bg-emerald' },
  { name: 'green', cls: 'bg-green' },
  { name: 'lime', cls: 'bg-lime' },
  { name: 'yellow', cls: 'bg-yellow' },
  { name: 'amber', cls: 'bg-amber' },
  { name: 'orange', cls: 'bg-orange' },
  { name: 'red', cls: 'bg-red' },
  { name: 'rose', cls: 'bg-rose' },
  { name: 'purple', cls: 'bg-purple' },
  { name: 'violet', cls: 'bg-violet' },
  { name: 'slate', cls: 'bg-slate' },
]

type PropRow = { id: string; propiedad: string; estado: 'publicada' | 'revision'; vistas: number; salud: 'green' | 'yellow' | 'red' }

const PROP_ROWS: PropRow[] = [
  { id: '1', propiedad: 'Depto 2 amb · Palermo', estado: 'publicada', vistas: 42, salud: 'green' },
  { id: '2', propiedad: 'Casa · Tigre', estado: 'revision', vistas: 11, salud: 'yellow' },
  { id: '3', propiedad: 'PH · Villa Crespo', estado: 'publicada', vistas: 4, salud: 'red' },
]

const SALUD_DOT: Record<PropRow['salud'], string> = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-danger' }

const PROP_COLUMNS: Column<PropRow>[] = [
  { key: 'propiedad', header: 'Propiedad' },
  {
    key: 'estado',
    header: 'Estado',
    render: r =>
      r.estado === 'publicada'
        ? <Badge tone="success">Publicada</Badge>
        : <Badge tone="warning">En revisión</Badge>,
  },
  { key: 'vistas', header: 'Vistas/día', align: 'right' },
  {
    key: 'salud',
    header: 'Salud',
    render: r => (
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${SALUD_DOT[r.salud]}`} />
        <span className="capitalize text-gray-600">{r.salud}</span>
      </span>
    ),
  },
]

export default function DesignSystemPage() {
  const [tab, setTab] = useState('actividad')
  const [view, setView] = useState('mes')
  const [wsp, setWsp] = useState(true)
  const [auto, setAuto] = useState(false)
  const [email, setEmail] = useState(true)
  const [op, setOp] = useState('venta')
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <header className="pb-8 border-b border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-pink mb-3">
            Design System · en vivo
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">
            Componentes de{' '}
            <span className="bg-gradient-to-r from-brand-pink to-brand-orange bg-clip-text text-transparent">
              VendéPro
            </span>
          </h1>
          <p className="text-gray-500 mt-3 max-w-xl">
            Estos son los componentes reales de <code className="text-brand-pink">src/components/ui</code>.
            Editá un token en <code className="text-brand-pink">globals.css</code> o un componente y el
            cambio se refleja acá y en toda la app.
          </p>
        </header>

        {/* Foundations · color */}
        <Section title="Foundations · Color" hint="Tokens de marca (@theme en globals.css). Cambiar el hex acá cambia todo.">
          <h3 className="text-sm font-semibold text-ink mb-3">Marca</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SWATCHES.map(s => (
              <div key={s.name} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <div className={`h-16 ${s.cls}`} />
                <div className="p-3">
                  <div className="text-sm font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-gray-500 font-mono uppercase mt-0.5">{s.hex}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-ink mt-8 mb-1">Semánticos <span className="font-normal text-gray-400">· estado</span></h3>
          <p className="text-xs text-gray-500 mb-3">Tono elegido para buena legibilidad como texto/estado. Uso: <code className="text-primary">bg-success/10 text-success</code>, <code className="text-primary">text-danger</code>, etc.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SEMANTIC_SWATCHES.map(s => (
              <div key={s.name} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <div className="h-16" style={{ backgroundColor: `var(${s.var})` }} />
                <div className="p-3">
                  <div className="text-sm font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">→ {s.hex}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-ink mt-8 mb-1">Paleta genérica <span className="font-normal text-gray-400">· por color</span></h3>
          <p className="text-xs text-gray-500 mb-3">Colores base del sistema. Cada uno genera <code className="text-primary">bg-*</code> / <code className="text-primary">text-*</code> con opacidad.</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
            {PALETTE_SWATCHES.map(s => (
              <div key={s.name} className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                <div className={`h-10 ${s.cls}`} />
                <div className="px-2 py-1.5 text-[11px] font-medium text-ink truncate">{s.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Foundations · tipografía */}
        <Section title="Foundations · Tipografía" hint="Heading y Text: la escala (tamaños + pesos) vive en un solo lugar y se propaga a toda la app.">
          <div className="flex flex-col gap-3">
            <Heading level={1}>Título de página · Heading 1</Heading>
            <Heading level={2}>Título de sección · Heading 2</Heading>
            <Heading level={3}>Encabezado de card · Heading 3</Heading>
            <Heading level={4}>Subtítulo · Heading 4</Heading>
          </div>
          <div className="flex flex-col gap-1.5 mt-6">
            <Text size="lg">Text lg · 18px — destacado de lectura.</Text>
            <Text size="base">Text base · 16px — texto de lectura cómoda.</Text>
            <Text>Text sm · 14px — el cuerpo de trabajo por defecto del CRM.</Text>
            <Text size="xs" tone="muted">Text xs · 12px muted — metadatos y labels secundarios.</Text>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <Text weight="medium">medium</Text>
            <Text weight="semibold">semibold</Text>
            <Text weight="bold">bold</Text>
            <Text tone="primary" weight="medium">primary</Text>
            <Text tone="success" weight="medium">success</Text>
            <Text tone="danger" weight="medium">danger</Text>
            <Text tone="muted">muted</Text>
          </div>
        </Section>

        {/* Foundations · radios y sombras */}
        <Section title="Foundations · Radios y sombras" hint="Tokens ajustables: cambiás el radio/sombra en globals.css y se actualizan todos los componentes.">
          <h3 className="text-sm font-semibold text-ink mb-3">Radios</h3>
          <div className="flex flex-wrap gap-5">
            <div className="text-center">
              <div className="w-20 h-16 bg-primary/10 border border-primary/20 rounded-control" />
              <div className="text-xs text-gray-500 font-mono mt-2">rounded-control<br />8px · controles</div>
            </div>
            <div className="text-center">
              <div className="w-20 h-16 bg-primary/10 border border-primary/20 rounded-card" />
              <div className="text-xs text-gray-500 font-mono mt-2">rounded-card<br />12px · contenedores</div>
            </div>
            <div className="text-center">
              <div className="w-20 h-16 bg-primary/10 border border-primary/20 rounded-full" />
              <div className="text-xs text-gray-500 font-mono mt-2">rounded-full<br />chips · avatares</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-ink mt-8 mb-3">Sombras</h3>
          <div className="flex flex-wrap gap-6">
            <div className="text-center">
              <div className="w-32 h-20 bg-white rounded-card shadow-card" />
              <div className="text-xs text-gray-500 font-mono mt-3">shadow-card<br />superficies</div>
            </div>
            <div className="text-center">
              <div className="w-32 h-20 bg-white rounded-card shadow-pop" />
              <div className="text-xs text-gray-500 font-mono mt-3">shadow-pop<br />flotantes</div>
            </div>
          </div>
        </Section>

        {/* Botones */}
        <Section title="Botones" hint="Variantes, tamaños y estados. Radio y padding unificados.">
          <div className="space-y-4">
            <Row>
              <Button variant="primary" icon={<Plus className="w-4 h-4" />}>Nueva propiedad</Button>
              <Button variant="outline">Ver detalle</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>Eliminar</Button>
            </Row>
            <Row>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading>Guardando…</Button>
              <Button disabled>Deshabilitado</Button>
            </Row>
          </div>
        </Section>

        {/* Canales de contacto */}
        <Section title="Canales de contacto" hint="La decisión de cada canal (color, ícono, link) vive en UN componente. Cambiás el componente y se actualiza en toda la app.">
          <div className="space-y-4">
            <Row>
              <CallButton phone="+541155551234" />
              <WhatsAppButton phone="+541155551234" />
              <Text size="xs" tone="muted" className="ml-2">con teléfono</Text>
            </Row>
            <Row>
              <CallButton phone={null} />
              <WhatsAppButton phone={null} />
              <Text size="xs" tone="muted" className="ml-2">sin teléfono (deshabilitado)</Text>
            </Row>
            <Row>
              <CallButton phone="+541155551234" iconOnly />
              <WhatsAppButton phone="+541155551234" iconOnly />
              <Text size="xs" tone="muted" className="ml-2">iconOnly — la misma decisión, forma de ícono</Text>
            </Row>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" hint="Tonos semánticos genéricos (con dot opcional).">
          <Row>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="primary" dot>Primary</Badge>
            <Badge tone="success" dot>Publicada</Badge>
            <Badge tone="warning" dot>En revisión</Badge>
            <Badge tone="danger" dot>Vencido</Badge>
            <Badge tone="info">Info</Badge>
          </Row>
        </Section>

        {/* Dominio · etapas */}
        <Section title="Etapas del lead" hint="StageBadge lee los colores desde crm-config (LEAD_STAGES).">
          <Row>
            {LEAD_STAGE_KEYS.map(stage => (
              <StageBadge key={stage} stage={stage} dot />
            ))}
          </Row>
        </Section>

        {/* Dominio · eventos */}
        <Section title="Tipos de evento" hint="EventChip lee color e ícono desde crm-config (EVENT_TYPES).">
          <Row>
            {(Object.keys(EVENT_TYPES) as EventType[]).map(t => (
              <EventChip key={t} type={t} />
            ))}
          </Row>
        </Section>

        {/* Cards */}
        <Section title="Cards" hint="Superficie base. La diagramación interna se compone según el caso.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
            {/* KPI */}
            <Card className="flex flex-col">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Building2 className="w-5 h-5" />
                </span>
                <Badge tone="success" dot>+12%</Badge>
              </div>
              <div className="text-3xl font-bold text-ink tracking-tight mt-4">128</div>
              <p className="text-sm text-gray-500 mt-0.5">Propiedades activas</p>
            </Card>

            {/* Contacto — nombre sin cortar (min-w-0 + truncate, badge shrink-0) */}
            <Card interactive className="flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <Avatar name="Marcela Genta" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">Marcela Genta</div>
                  <div className="text-xs text-gray-500">Admin</div>
                </div>
                <StageBadge stage="captado" className="shrink-0" />
              </div>
            </Card>

            {/* Avatares con etiqueta de tamaño */}
            <Card className="flex flex-col">
              <CardTitle>Avatares</CardTitle>
              <div className="flex items-end gap-4 mt-4">
                {([['sm', 'Ana López'], ['md', 'Pato Barcia'], ['lg', 'Juan Pérez']] as const).map(([size, name]) => (
                  <div key={size} className="flex flex-col items-center gap-1.5">
                    <Avatar name={name} size={size} />
                    <span className="text-[10px] font-mono text-gray-400">{size}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        {/* Forms */}
        <Section title="Formularios" hint="Input, Textarea, Select y Field (label + hint/error).">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Field label="Nombre del contacto" htmlFor="ds-nombre" required>
              <Input id="ds-nombre" placeholder="Ej: Marcela Genta" />
            </Field>
            <Field label="Etapa" htmlFor="ds-etapa" hint="Se sincroniza con el pipeline">
              <Select id="ds-etapa" defaultValue="nuevo">
                {LEAD_STAGE_KEYS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Email" htmlFor="ds-email" error="El email no es válido" className="sm:col-span-2">
              <Input id="ds-email" defaultValue="marcela@" />
            </Field>
            <Field label="Notas" htmlFor="ds-notas" className="sm:col-span-2">
              <Textarea id="ds-notas" placeholder="Contexto de la operación…" />
            </Field>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <Button icon={<Search className="w-4 h-4" />}>Buscar</Button>
            <Button variant="ghost">Limpiar</Button>
          </div>
        </Section>

        {/* Tabs + Segmented */}
        <Section title="Tabs & Segmented" hint="Navegación por secciones y cambio de vista. Interactivos.">
          <div className="space-y-6">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'actividad', label: 'Actividad', count: 8 },
                { value: 'propiedades', label: 'Propiedades', count: 3 },
                { value: 'documentos', label: 'Documentos' },
                { value: 'historial', label: 'Historial' },
              ]}
            />
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'mes', label: 'Mes' },
                { value: 'semana', label: 'Semana' },
                { value: 'dia', label: 'Día' },
                { value: 'agenda', label: 'Agenda' },
              ]}
            />
          </div>
        </Section>

        {/* Switch / Checkbox / Radio */}
        <Section title="Switch, Checkbox & Radio" hint="Controles de selección. Marcado = color primario. Interactivos.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col gap-3">
              <Switch checked={wsp} onChange={setWsp} label="Notificar por WhatsApp" />
              <Switch checked={auto} onChange={setAuto} label="Publicar automáticamente" />
            </div>
            <div className="flex flex-col gap-2.5">
              <Checkbox checked={email} onChange={setEmail} label="Enviar por email" />
              <Checkbox checked={wsp} onChange={setWsp} label="Enviar por WhatsApp" />
              <Checkbox checked={false} onChange={() => {}} label="Publicar en redes" disabled />
            </div>
            <RadioGroup
              name="operacion"
              value={op}
              onChange={setOp}
              options={[
                { value: 'venta', label: 'Venta' },
                { value: 'alquiler', label: 'Alquiler' },
                { value: 'temporario', label: 'Alquiler temporario' },
              ]}
            />
          </div>
        </Section>

        {/* Tags */}
        <Section title="Tags & chips" hint="Selección de atributos y etiquetas removibles.">
          <div className="flex flex-wrap items-center gap-3">
            <Tag icon={<Car className="w-4 h-4" />}>Cochera</Tag>
            <Tag icon={<Sun className="w-4 h-4" />}>Balcón</Tag>
            <Tag icon={<Waves className="w-4 h-4" />}>Pileta</Tag>
            <Tag variant="soft" onRemove={() => {}}>Apto crédito</Tag>
            <Tag variant="soft" onRemove={() => {}}>Amoblado</Tag>
          </div>
        </Section>

        {/* Modal */}
        <Section title="Modal" hint="Dialog genérico. Cierra con Esc o click afuera.">
          <Button variant="outline" onClick={() => setModalOpen(true)}>Abrir modal</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Publicar propiedad"
            icon={<AlertTriangle className="w-4 h-4" />}
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={() => setModalOpen(false)}>Publicar</Button>
              </>
            }
          >
            Vas a publicar “Depto 2 amb · Palermo” en todos los portales conectados.
            Podés despublicarla cuando quieras.
          </Modal>
        </Section>

        {/* Empty state */}
        <Section title="Empty state" hint="Estado vacío operativo con CTA.">
          <Card padded={false}>
            <EmptyState
              icon={<Inbox className="w-6 h-6" />}
              title="Todavía no hay leads"
              description="Cuando entre un prospecto lo vas a ver acá para asignarlo y contactarlo."
              action={<Button icon={<Plus className="w-4 h-4" />}>Cargar lead</Button>}
            />
          </Card>
        </Section>

        {/* Tooltip + Dropdown */}
        <Section title="Tooltip & Dropdown" hint="Etiqueta al hover y menú contextual. Interactivos.">
          <div className="flex flex-wrap items-center gap-8">
            <Tooltip label="Reasignar a otro agente">
              <Button variant="outline" icon={<HelpCircle className="w-4 h-4" />}>Hover acá</Button>
            </Tooltip>
            <Dropdown
              align="left"
              trigger={
                <Button variant="ghost" className="!px-2" aria-label="Más acciones">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              }
            >
              <DropdownItem icon={<Pencil className="w-4 h-4" />}>Editar</DropdownItem>
              <DropdownItem icon={<Copy className="w-4 h-4" />}>Duplicar</DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger>Eliminar</DropdownItem>
            </Dropdown>
          </div>
        </Section>

        {/* Table */}
        <Section title="Tabla" hint="Data-driven, con columnas tipadas y celdas custom.">
          <Table
            rowKey={r => r.id as string}
            columns={PROP_COLUMNS}
            data={PROP_ROWS}
          />
        </Section>

        {/* Timeline + Progress */}
        <Section title="Timeline & Progreso" hint="Historial de etapas (colores desde crm-config) + barra y pasos.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <Timeline
              items={[
                { label: 'Captado', meta: 'Hoy · 14:30 · Marcela G.', color: getStageDot('captado') },
                { label: 'En tasación', meta: 'Ayer · 11:00', color: getStageDot('en_tasacion') },
                { label: 'Contactado', meta: 'Lun · 09:15', color: getStageDot('contactado') },
                { label: 'Nuevo', meta: 'Vie · 18:40', color: getStageDot('nuevo') },
              ]}
            />
            <div className="flex flex-col gap-6">
              <Steps total={5} current={3} />
              <div className="flex flex-col gap-1.5 max-w-xs">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Perfil completo</span><span>70%</span>
                </div>
                <ProgressBar value={70} />
              </div>
            </div>
          </div>
        </Section>

        {/* Drawer */}
        <Section title="Drawer" hint="Panel lateral para configuración/detalle. Cierra con Esc o click afuera.">
          <Button variant="outline" icon={<Settings className="w-4 h-4" />} onClick={() => setDrawerOpen(true)}>
            Configurar landing
          </Button>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Configurar landing"
            footer={<Button fullWidth onClick={() => setDrawerOpen(false)}>Guardar cambios</Button>}
          >
            <div className="flex flex-col gap-4">
              <Field label="Título">
                <Input defaultValue="Depto en Palermo" />
              </Field>
              <Switch checked={wsp} onChange={setWsp} label="Mostrar precio" />
              <Switch checked={auto} onChange={setAuto} label="Formulario de contacto" />
            </div>
          </Drawer>
        </Section>

        {/* Notificaciones */}
        <Section title="Notificaciones" hint="Campana con punto de sin-leer + panel.">
          <div className="flex flex-wrap items-start gap-6">
            <NotificationBell hasUnread />
            <NotificationPanel
              onMarkAllRead={() => {}}
              items={[
                { id: '1', text: <>Nuevo lead asignado: <b>Juan Pérez</b></>, time: 'Hace 5 min', unread: true },
                { id: '2', text: 'Tasación de Tigre vence hoy', time: 'Hace 1 h', unread: true },
                { id: '3', text: 'Propiedad publicada en portales', time: 'Ayer' },
              ]}
            />
          </div>
        </Section>

        {/* Pipeline / Kanban */}
        <Section title="Pipeline / Kanban" hint="Board presentacional; borde de card y punto de columna desde crm-config.">
          <KanbanBoard>
            <KanbanColumn title="Nuevo" count={2} color={getStageDot('nuevo')}>
              <KanbanCard color={getStageDot('nuevo')}>
                <div className="text-[13px] font-semibold text-ink">Juan Pérez</div>
                <div className="text-xs text-gray-500 mt-0.5">🏠 Depto Palermo · hoy</div>
              </KanbanCard>
              <KanbanCard color={getStageDot('nuevo')}>
                <div className="text-[13px] font-semibold text-ink">Ana Gómez</div>
                <div className="text-xs text-gray-500 mt-0.5">📞 Sin contactar</div>
              </KanbanCard>
            </KanbanColumn>
            <KanbanColumn title="Contactado" count={1} color={getStageDot('contactado')}>
              <KanbanCard color={getStageDot('contactado')}>
                <div className="text-[13px] font-semibold text-ink">Luis Torres</div>
                <div className="text-xs text-gray-500 mt-0.5">⏰ Seguir en 2 días</div>
              </KanbanCard>
            </KanbanColumn>
            <KanbanColumn title="En tasación" count={1} color={getStageDot('en_tasacion')}>
              <KanbanCard color={getStageDot('en_tasacion')}>
                <div className="text-[13px] font-semibold text-ink">María López</div>
                <div className="text-xs text-gray-500 mt-0.5">📋 Visita agendada</div>
              </KanbanCard>
            </KanbanColumn>
            <KanbanColumn title="Captado" count={0} color={getStageDot('captado')} />
          </KanbanBoard>
        </Section>

        {/* Card de propiedad */}
        <Section title="Card de propiedad" hint="Foto + estado + precio + atributos.">
          <div className="flex flex-wrap gap-4">
            <PropertyCard
              title="Depto 2 ambientes"
              location="Palermo, CABA"
              price="USD 145.000"
              status={<Badge tone="success">Publicada</Badge>}
              beds={2}
              area={58}
              baths={1}
            />
            <PropertyCard
              title="Casa con jardín"
              location="Tigre, GBA Norte"
              price="USD 320.000"
              status={<Badge tone="warning">En revisión</Badge>}
              beds={4}
              area={180}
              baths={3}
            />
          </div>
        </Section>

        {/* Gráficos */}
        <Section title="Gráficos" hint="Recharts (color de datos = primary). Barras, dona y embudo.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Captaciones por mes</CardTitle>
              <div className="mt-3">
                <BarChart
                  data={[
                    { label: 'Ene', value: 9 }, { label: 'Feb', value: 12 }, { label: 'Mar', value: 10 },
                    { label: 'Abr', value: 16 }, { label: 'May', value: 14 }, { label: 'Jun', value: 20 },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardTitle>Origen de leads</CardTitle>
              <div className="mt-3">
                <DonutChart
                  data={[
                    { name: 'Portales', value: 62 },
                    { name: 'Referidos', value: 22 },
                    { name: 'Otros', value: 16 },
                  ]}
                />
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardTitle>Embudo de conversión</CardTitle>
              <div className="mt-4">
                <Funnel
                  steps={[
                    { label: 'Leads', value: 240 },
                    { label: 'Contactados', value: 197 },
                    { label: 'Tasaciones', value: 144 },
                    { label: 'Captadas', value: 91 },
                    { label: 'Vendidas', value: 48 },
                  ]}
                />
              </div>
            </Card>
          </div>
        </Section>
      </div>
    </div>
  )
}
