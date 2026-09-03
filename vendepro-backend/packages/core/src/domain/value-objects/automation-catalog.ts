import { ValidationError } from '../errors/validation-error'

/**
 * Catálogo declarativo del motor de automatizaciones.
 *
 * Es la fuente de verdad única: el motor valida contra esto, y el endpoint
 * `GET /automations/meta` lo sirve tal cual para que el editor del frontend
 * arme los selects sin hardcodear nada. Agregar un trigger o una acción es
 * agregar una entrada acá + su executor.
 */

// ── Triggers ──────────────────────────────────────────────────

export const AUTOMATION_TRIGGERS = [
  'lead.created',
  'lead.stage_changed',
  'lead.assigned',
  'contact.created',
  'property.stage_changed',
  'appraisal.created',
  'lead.sin_contacto_24h',
  'lead.sin_respuesta_7d',
  'property.publicacion_vencida',
] as const
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]

/** Triggers que dispara el cron en vez de un request. */
export const TIME_BASED_TRIGGERS: readonly AutomationTrigger[] = [
  'lead.sin_contacto_24h',
  'lead.sin_respuesta_7d',
  'property.publicacion_vencida',
]

export type EntityType = 'lead' | 'contact' | 'property' | 'appraisal'

export interface TriggerDefinition {
  key: AutomationTrigger
  label: string
  description: string
  entity_type: EntityType
  /** Campos de `trigger_config` que el editor debe pedir. */
  config_fields: ConfigField[]
  /** Prefijos de variable disponibles para las acciones de este trigger. */
  scopes: string[]
}

export interface ConfigField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'html' | 'user' | 'stage'
  required?: boolean
  /** Para 'select'/'multiselect' estáticos. Los dinámicos (stage, user) los resuelve el UI. */
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  help?: string
  default?: unknown
}

const BASE_SCOPES = ['org', 'agent', 'now']

export const TRIGGER_DEFINITIONS: readonly TriggerDefinition[] = [
  {
    key: 'lead.created',
    label: 'Se crea un lead',
    description: 'Apenas entra un lead nuevo al CRM, sin importar el origen.',
    entity_type: 'lead',
    config_fields: [],
    scopes: [...BASE_SCOPES, 'lead', 'contact'],
  },
  {
    key: 'lead.stage_changed',
    label: 'Un lead cambia de etapa',
    description: 'Cuando el lead pasa a la etapa que elijas.',
    entity_type: 'lead',
    config_fields: [
      {
        name: 'to_stage',
        label: 'Etapa destino',
        type: 'stage',
        required: true,
        help: 'Dejar vacío dispara con cualquier cambio de etapa.',
      },
      { name: 'from_stage', label: 'Etapa de origen (opcional)', type: 'stage' },
    ],
    scopes: [...BASE_SCOPES, 'lead', 'contact', 'stage'],
  },
  {
    key: 'lead.assigned',
    label: 'Se asigna un lead a un agente',
    description: 'Cuando cambia el agente responsable del lead.',
    entity_type: 'lead',
    config_fields: [],
    scopes: [...BASE_SCOPES, 'lead', 'contact'],
  },
  {
    key: 'contact.created',
    label: 'Se crea un contacto',
    description: 'Alta de una persona en la base de contactos.',
    entity_type: 'contact',
    config_fields: [],
    scopes: [...BASE_SCOPES, 'contact'],
  },
  {
    key: 'property.stage_changed',
    label: 'Una propiedad cambia de etapa',
    description: 'Cuando la propiedad pasa a la etapa comercial que elijas.',
    entity_type: 'property',
    config_fields: [
      { name: 'to_stage', label: 'Etapa destino', type: 'stage', required: true },
      { name: 'from_stage', label: 'Etapa de origen (opcional)', type: 'stage' },
    ],
    scopes: [...BASE_SCOPES, 'property', 'contact', 'stage'],
  },
  {
    key: 'appraisal.created',
    label: 'Se crea una tasación',
    description: 'Alta de una tasación en el sistema.',
    entity_type: 'appraisal',
    config_fields: [],
    scopes: [...BASE_SCOPES, 'appraisal', 'lead', 'contact'],
  },
  {
    key: 'lead.sin_contacto_24h',
    label: 'Lead sin contactar (SLA)',
    description: 'El lead lleva N horas sin pasar a "contactado". Lo evalúa el sistema cada 15 minutos.',
    entity_type: 'lead',
    config_fields: [
      { name: 'horas', label: 'Horas sin contactar', type: 'number', required: true, default: 24 },
    ],
    scopes: [...BASE_SCOPES, 'lead', 'contact'],
  },
  {
    key: 'lead.sin_respuesta_7d',
    label: 'Lead sin respuesta',
    description: 'El lead lleva N días sin actividad registrada. Lo evalúa el sistema cada 15 minutos.',
    entity_type: 'lead',
    config_fields: [
      { name: 'dias', label: 'Días sin actividad', type: 'number', required: true, default: 7 },
    ],
    scopes: [...BASE_SCOPES, 'lead', 'contact'],
  },
  {
    key: 'property.publicacion_vencida',
    label: 'Publicación por vencer',
    description: 'Faltan N días para que venza la publicación de la propiedad.',
    entity_type: 'property',
    config_fields: [
      { name: 'dias_antes', label: 'Días de anticipación', type: 'number', required: true, default: 7 },
    ],
    scopes: [...BASE_SCOPES, 'property', 'contact'],
  },
]

const TRIGGERS_BY_KEY = new Map(TRIGGER_DEFINITIONS.map((t) => [t.key, t]))

export function getTriggerDefinition(key: string): TriggerDefinition {
  const def = TRIGGERS_BY_KEY.get(key as AutomationTrigger)
  if (!def) {
    throw new ValidationError(
      `Trigger desconocido: "${key}". Permitidos: ${AUTOMATION_TRIGGERS.join(', ')}`,
      { trigger_type: 'Inválido' },
    )
  }
  return def
}

export function isTimeBasedTrigger(key: string): boolean {
  return TIME_BASED_TRIGGERS.includes(key as AutomationTrigger)
}

// ── Acciones ──────────────────────────────────────────────────

export const AUTOMATION_ACTIONS = [
  'send_email',
  'notify_agent',
  'send_internal_email',
  'create_calendar_event',
  'log_activity',
  'assign_lead',
  'change_stage',
  'add_tag',
  'send_webhook',
] as const
export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number]

/** Acciones implementadas en la Fase 1. El resto se valida pero se marca `skipped`. */
export const PHASE_1_ACTIONS: readonly AutomationActionType[] = [
  'send_email', 'notify_agent', 'create_calendar_event',
]

export interface ActionDefinition {
  key: AutomationActionType
  label: string
  description: string
  /** Entidades sobre las que tiene sentido — el editor filtra por el trigger elegido. */
  applies_to: readonly EntityType[]
  config_fields: ConfigField[]
  /** true si la acción puede reabrir el ciclo de eventos (guarda anti-loop). */
  chains_events?: boolean
  implemented: boolean
}

export const ACTION_DEFINITIONS: readonly ActionDefinition[] = [
  {
    key: 'send_email',
    label: 'Enviar email al cliente',
    description: 'Manda un email al lead o contacto. Respeta la lista de bajas y agrega el link de desuscripción.',
    applies_to: ['lead', 'contact', 'property', 'appraisal'],
    implemented: true,
    config_fields: [
      {
        name: 'subject',
        label: 'Asunto',
        type: 'text',
        required: true,
        placeholder: 'Gracias por contactarte, {{lead.first_name}}',
      },
      {
        name: 'body_html',
        label: 'Mensaje',
        type: 'html',
        required: true,
        placeholder: 'Hola {{lead.first_name}}, gracias por contactarte. En breve un agente se comunicará con vos.',
      },
      {
        name: 'include_unsubscribe',
        label: 'Incluir link de desuscripción',
        type: 'boolean',
        default: true,
        help: 'Obligatorio para emails comerciales. Sólo se puede apagar en avisos transaccionales.',
      },
      {
        name: 'reply_to_agent',
        label: 'Responder al agente asignado',
        type: 'boolean',
        default: true,
        help: 'Si está activo, las respuestas van al mail del agente en vez del remitente de la org.',
      },
    ],
  },
  {
    key: 'notify_agent',
    label: 'Notificar al agente',
    description: 'Deja una notificación dentro de la plataforma para el agente asignado.',
    applies_to: ['lead', 'contact', 'property', 'appraisal'],
    implemented: true,
    config_fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Lead sin contactar' },
      {
        name: 'message',
        label: 'Mensaje',
        type: 'textarea',
        required: true,
        placeholder: '{{lead.full_name}} entró hace 24h y sigue sin contactar.',
      },
      {
        name: 'target',
        label: 'Destinatario',
        type: 'select',
        default: 'assigned_agent',
        options: [
          { value: 'assigned_agent', label: 'Agente asignado' },
          { value: 'admins', label: 'Administradores' },
          { value: 'specific_user', label: 'Usuario específico' },
        ],
      },
      { name: 'user_id', label: 'Usuario', type: 'user', help: 'Sólo si el destinatario es "Usuario específico".' },
    ],
  },
  {
    key: 'send_internal_email',
    label: 'Enviar email interno',
    description: 'Manda un email al equipo (agente asignado, admins o una dirección fija).',
    applies_to: ['lead', 'contact', 'property', 'appraisal'],
    implemented: false,
    config_fields: [
      { name: 'subject', label: 'Asunto', type: 'text', required: true },
      { name: 'body_html', label: 'Mensaje', type: 'html', required: true },
      {
        name: 'target',
        label: 'Destinatario',
        type: 'select',
        default: 'assigned_agent',
        options: [
          { value: 'assigned_agent', label: 'Agente asignado' },
          { value: 'admins', label: 'Administradores' },
          { value: 'fixed', label: 'Dirección fija' },
        ],
      },
      { name: 'email', label: 'Email', type: 'text', help: 'Sólo si el destinatario es "Dirección fija".' },
    ],
  },
  {
    key: 'create_calendar_event',
    label: 'Crear tarea en el calendario',
    description: 'Agenda un evento para el agente asignado. Si conectó su Google Calendar, también aparece ahí.',
    applies_to: ['lead', 'contact', 'property', 'appraisal'],
    implemented: true,
    config_fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Seguimiento: {{lead.full_name}}' },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      {
        name: 'event_type',
        label: 'Tipo de evento',
        type: 'select',
        required: true,
        default: 'seguimiento',
        options: [
          { value: 'llamada', label: 'Llamada' },
          { value: 'reunion', label: 'Reunión' },
          { value: 'visita_captacion', label: 'Visita de captación' },
          { value: 'visita_comprador', label: 'Visita de comprador' },
          { value: 'tasacion', label: 'Tasación' },
          { value: 'seguimiento', label: 'Seguimiento' },
          { value: 'admin', label: 'Administrativo' },
          { value: 'firma', label: 'Firma' },
          { value: 'otro', label: 'Otro' },
        ],
      },
      {
        name: 'due_in_days',
        label: 'Vence en (días)',
        type: 'number',
        required: true,
        default: 7,
        help: 'Contado desde el momento en que se dispara la automatización.',
      },
    ],
  },
  {
    key: 'log_activity',
    label: 'Registrar actividad',
    description: 'Deja rastro en el feed de actividad de la entidad.',
    applies_to: ['lead', 'contact', 'property'],
    implemented: false,
    config_fields: [
      { name: 'activity_type', label: 'Tipo', type: 'text', required: true, default: 'automatizacion' },
      { name: 'notes', label: 'Detalle', type: 'textarea', required: true },
    ],
  },
  {
    key: 'assign_lead',
    label: 'Asignar el lead',
    description: 'Asigna el lead a un agente fijo o reparte por round-robin entre los activos.',
    applies_to: ['lead'],
    implemented: false,
    config_fields: [
      {
        name: 'mode',
        label: 'Modo',
        type: 'select',
        required: true,
        default: 'round_robin',
        options: [
          { value: 'round_robin', label: 'Round-robin entre agentes activos' },
          { value: 'specific_user', label: 'Agente específico' },
        ],
      },
      { name: 'user_id', label: 'Agente', type: 'user' },
      {
        name: 'only_if_unassigned',
        label: 'Sólo si no tiene agente',
        type: 'boolean',
        default: true,
        help: 'Evita pisar una asignación hecha a mano.',
      },
    ],
  },
  {
    key: 'change_stage',
    label: 'Cambiar la etapa',
    description: 'Mueve la entidad a otra etapa. Si la transición no es válida, la acción se marca como fallida sin romper el resto.',
    applies_to: ['lead', 'property'],
    implemented: false,
    chains_events: true,
    config_fields: [
      { name: 'to_stage', label: 'Etapa destino', type: 'stage', required: true },
      { name: 'notes', label: 'Nota del cambio', type: 'text', default: 'Cambio automático' },
    ],
  },
  {
    key: 'add_tag',
    label: 'Agregar etiqueta',
    description: 'Etiqueta al contacto vinculado.',
    applies_to: ['lead', 'contact'],
    implemented: false,
    config_fields: [{ name: 'tags', label: 'Etiquetas', type: 'multiselect', required: true }],
  },
  {
    key: 'send_webhook',
    label: 'Llamar a un webhook',
    description: 'Hace un POST firmado a una URL propia. Sirve para WhatsApp o SMS vía n8n.',
    applies_to: ['lead', 'contact', 'property', 'appraisal'],
    implemented: false,
    config_fields: [
      { name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
      { name: 'secret', label: 'Secret (firma HMAC)', type: 'text' },
    ],
  },
]

const ACTIONS_BY_KEY = new Map(ACTION_DEFINITIONS.map((a) => [a.key, a]))

export function getActionDefinition(key: string): ActionDefinition {
  const def = ACTIONS_BY_KEY.get(key as AutomationActionType)
  if (!def) {
    throw new ValidationError(
      `Acción desconocida: "${key}". Permitidas: ${AUTOMATION_ACTIONS.join(', ')}`,
      { action_type: 'Inválida' },
    )
  }
  return def
}

/** Acciones que pueden reabrir el ciclo de eventos — el motor las corta a depth >= 1. */
export function actionChainsEvents(key: string): boolean {
  return ACTIONS_BY_KEY.get(key as AutomationActionType)?.chains_events === true
}

// ── Condiciones ───────────────────────────────────────────────

export const CONDITION_OPERATORS = [
  'eq', 'neq', 'contains', 'not_contains',
  'gt', 'gte', 'lt', 'lte',
  'is_empty', 'is_not_empty', 'in', 'not_in',
] as const
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'es igual a',
  neq: 'no es igual a',
  contains: 'contiene',
  not_contains: 'no contiene',
  gt: 'es mayor que',
  gte: 'es mayor o igual que',
  lt: 'es menor que',
  lte: 'es menor o igual que',
  is_empty: 'está vacío',
  is_not_empty: 'no está vacío',
  in: 'está entre',
  not_in: 'no está entre',
}

/** Operadores que no llevan valor a la derecha. */
export const UNARY_OPERATORS: readonly ConditionOperator[] = ['is_empty', 'is_not_empty']

export function isConditionOperator(op: string): op is ConditionOperator {
  return (CONDITION_OPERATORS as readonly string[]).includes(op)
}

// ── Variables interpolables ───────────────────────────────────

export interface VariableDefinition {
  /** Token tal cual se escribe: `lead.full_name` → `{{lead.full_name}}` */
  key: string
  label: string
  scope: string
  example: string
}

export const VARIABLE_DEFINITIONS: readonly VariableDefinition[] = [
  { key: 'lead.full_name', label: 'Nombre completo del lead', scope: 'lead', example: 'Ana Pérez' },
  { key: 'lead.first_name', label: 'Nombre del lead', scope: 'lead', example: 'Ana' },
  { key: 'lead.email', label: 'Email del lead', scope: 'lead', example: 'ana@mail.com' },
  { key: 'lead.phone', label: 'Teléfono del lead', scope: 'lead', example: '11 5555-5555' },
  { key: 'lead.stage', label: 'Etapa del lead', scope: 'lead', example: 'contactado' },
  { key: 'lead.pipeline', label: 'Pipeline del lead', scope: 'lead', example: 'vendedor' },
  { key: 'lead.source', label: 'Origen del lead', scope: 'lead', example: 'zonaprop' },
  { key: 'lead.operation', label: 'Operación', scope: 'lead', example: 'venta' },
  { key: 'contact.full_name', label: 'Nombre completo del contacto', scope: 'contact', example: 'Ana Pérez' },
  { key: 'contact.first_name', label: 'Nombre del contacto', scope: 'contact', example: 'Ana' },
  { key: 'contact.email', label: 'Email del contacto', scope: 'contact', example: 'ana@mail.com' },
  { key: 'contact.phone', label: 'Teléfono del contacto', scope: 'contact', example: '11 5555-5555' },
  { key: 'property.title', label: 'Título de la propiedad', scope: 'property', example: 'Depto 3 amb en Belgrano' },
  { key: 'property.address', label: 'Dirección', scope: 'property', example: 'Av. Cabildo 1234' },
  { key: 'property.price', label: 'Precio', scope: 'property', example: 'USD 180.000' },
  { key: 'property.stage', label: 'Etapa comercial', scope: 'property', example: 'publicada' },
  { key: 'property.public_url', label: 'Link del reporte público', scope: 'property', example: 'https://…/r/abc123' },
  { key: 'appraisal.public_url', label: 'Link de la tasación', scope: 'appraisal', example: 'https://…/t/abc123' },
  { key: 'agent.full_name', label: 'Nombre del agente asignado', scope: 'agent', example: 'Marcela Genta' },
  { key: 'agent.email', label: 'Email del agente', scope: 'agent', example: 'marcela@mg.com.ar' },
  { key: 'agent.phone', label: 'Teléfono del agente', scope: 'agent', example: '11 4444-4444' },
  { key: 'org.name', label: 'Nombre de la inmobiliaria', scope: 'org', example: 'Marcela Genta Operaciones' },
  { key: 'stage.from', label: 'Etapa anterior', scope: 'stage', example: 'nuevo' },
  { key: 'stage.to', label: 'Etapa nueva', scope: 'stage', example: 'contactado' },
  { key: 'now.date', label: 'Fecha de hoy', scope: 'now', example: '27/08/2026' },
  { key: 'unsubscribe_url', label: 'Link de desuscripción', scope: 'org', example: 'https://…/unsubscribe/…' },
]

/** Variables disponibles para un trigger dado, según sus scopes. */
export function variablesForTrigger(triggerKey: string): VariableDefinition[] {
  const def = getTriggerDefinition(triggerKey)
  const scopes = new Set(def.scopes)
  return VARIABLE_DEFINITIONS.filter((v) => scopes.has(v.scope))
}

// ── Categorías de recetas ─────────────────────────────────────

/**
 * Agrupa las recetas del catálogo por momento del negocio, que es como las
 * busca la inmobiliaria ("¿qué tengo para tasaciones?"). Agrupar por entidad
 * no sirve: el 70% de las recetas cuelga de `lead` y la galería vuelve a ser
 * una lista plana.
 *
 * El orden del array es el orden en que se muestran las secciones.
 */
export const RECIPE_CATEGORIES = [
  {
    key: 'entrada_leads',
    label: 'Entrada de leads',
    description: 'Lo que pasa apenas entra una consulta nueva.',
  },
  {
    key: 'alertas',
    label: 'Alertas y SLA',
    description: 'Avisos cuando algo se está pasando de tiempo.',
  },
  {
    key: 'tasacion',
    label: 'Tasación',
    description: 'Acompañamiento del propietario mientras se tasa la propiedad.',
  },
  {
    key: 'captacion',
    label: 'Captación',
    description: 'Del lead calificado a la propiedad captada.',
  },
  {
    key: 'propiedades',
    label: 'Propiedades publicadas',
    description: 'Seguimiento de la propiedad ya en comercialización.',
  },
  {
    key: 'otras',
    label: 'Otras',
    description: 'Recetas que todavía no se clasificaron.',
  },
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]['key']

/** Cajón de las recetas sin clasificar. Siempre va última en la galería. */
export const DEFAULT_RECIPE_CATEGORY: RecipeCategory = 'otras'

/**
 * `template_key` → categoría. Las recetas viven en el seed SQL (044), pero la
 * categoría es metadata de presentación: no cambia el motor y no justifica una
 * migración cada vez que se reordena la galería, así que se declara acá junto
 * al resto del catálogo.
 *
 * Una receta que falte cae en "Otras" — el test del seed lo marca.
 */
const RECIPE_CATEGORY_BY_TEMPLATE: Record<string, RecipeCategory> = {
  lead_bienvenida: 'entrada_leads',
  lead_portal: 'entrada_leads',
  sla_contacto_24h: 'alertas',
  lead_frio_7d: 'alertas',
  tasacion_en_curso: 'tasacion',
  seguimiento_presentada: 'tasacion',
  email_post_tasacion: 'tasacion',
  lead_calificado_visita: 'captacion',
  lead_captado: 'captacion',
  propiedad_publicada: 'propiedades',
  publicacion_por_vencer: 'propiedades',
}

export function categoryForTemplate(templateKey: string): RecipeCategory {
  return RECIPE_CATEGORY_BY_TEMPLATE[templateKey] ?? DEFAULT_RECIPE_CATEGORY
}
