import type { AppraisalContext } from '../renderer/types'

export const MOCK_APPRAISAL: AppraisalContext = {
  id: 'mock',
  property_address: 'Av. Siempreviva 742',
  neighborhood: 'Villa Urquiza',
  city: 'CABA',
  property_type: 'casa',
  covered_area: 185,
  total_area: 240,
  semi_area: 20,
  weighted_area: 200,
  swot: {
    strengths: 'Ubicación cercana al subte. Casa bien iluminada.',
    weaknesses: 'Necesita pintura en ambientes principales.',
    opportunities: 'Zona con plusvalía ascendente.',
    threats: 'Nuevos desarrollos cercanos.',
  },
  prices: { suggested: 450000, test: 475000, expected_close: 420000, usd_per_m2: 2432 },
  comparables: [
    { id: 'c1', appraisal_id: 'mock', zonaprop_url: null, address: 'Av. Cabildo 3000', total_area: 200, covered_area: 180, price: 440000, usd_per_m2: 2444, sort_order: 0 },
    { id: 'c2', appraisal_id: 'mock', zonaprop_url: null, address: 'Mendoza 4200', total_area: 220, covered_area: 195, price: 460000, usd_per_m2: 2359, sort_order: 1 },
  ],
  agent: { name: 'Marcela Genta', phone: '+5411 5555-5555', email: 'marcela@mg.com', avatar_url: null },
  org: { name: 'Marcela Genta Operaciones Inmobiliarias', logo_url: null, brand_color: '#ff007c', brand_accent_color: '#ff8017' },
}
