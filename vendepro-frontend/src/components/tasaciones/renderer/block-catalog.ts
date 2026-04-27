import type { AppraisalBlockType } from './types'

interface BlockMeta {
  label: string
  description: string
}

export const BLOCK_CATALOG: Record<AppraisalBlockType, BlockMeta> = {
  cover: {
    label: 'Portada',
    description: 'Tapa con foto, dirección y datos del asesor.',
  },
  proposal_commercial: {
    label: 'Propuesta comercial',
    description: 'Mensaje al propietario explicando el servicio.',
  },
  services_grid: {
    label: 'Nuestros servicios',
    description: 'Grilla con los servicios de la inmobiliaria.',
  },
  market_stats: {
    label: 'Estadísticas de mercado',
    description: 'Tiempos de venta y precios por zona.',
  },
  funnel_chart: {
    label: 'Embudo de venta',
    description: 'Recorrido desde visita hasta firma.',
  },
  methodology: {
    label: 'Metodología de trabajo',
    description: 'Pasos del proceso de venta.',
  },
  notary_charts: {
    label: 'Gastos e impuestos',
    description: 'Honorarios, sellos e impuestos de la operación.',
  },
  property_data: {
    label: 'Datos de la propiedad',
    description: 'Dirección, tipología y metros cuadrados.',
  },
  swot: {
    label: 'FODA',
    description: 'Fortalezas, debilidades, oportunidades y amenazas.',
  },
  zone_map: {
    label: 'Mapa de zona',
    description: 'Ubicación con puntos de interés.',
  },
  comparables_list: {
    label: 'Propiedades comparables',
    description: 'Inmuebles similares en venta para fijar el precio.',
  },
  price_projection: {
    label: 'Proyección de precios',
    description: 'Precio sugerido, de prueba y cierre esperado.',
  },
  work_conditions: {
    label: 'Condiciones de trabajo',
    description: 'Honorarios, exclusividad y plazos del contrato.',
  },
  video_gallery: {
    label: 'Videos',
    description: 'Galería de videos (solo en versión web).',
  },
  extra_media: {
    label: 'Material extra',
    description: 'Imágenes y archivos extra (solo versión web).',
  },
  cta_whatsapp: {
    label: 'Botón de WhatsApp',
    description: 'Chat directo con el asesor (solo versión web).',
  },
  agent_contact_card: {
    label: 'Ficha del asesor',
    description: 'Foto y datos de contacto (solo versión web).',
  },
}

export function getBlockMeta(type: AppraisalBlockType): BlockMeta {
  return BLOCK_CATALOG[type] ?? { label: type, description: '' }
}
