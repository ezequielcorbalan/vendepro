import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AutomatizacionesPage from '../page'

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'admin-1', role: 'admin' }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))

const toast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast }) }))

const RECIPE_CATEGORIES = [
  { key: 'entrada_leads', label: 'Entrada de leads', description: 'Lo que pasa apenas entra una consulta.' },
  { key: 'tasacion', label: 'Tasación', description: 'Mientras se tasa la propiedad.' },
  { key: 'otras', label: 'Otras', description: 'Sin clasificar.' },
]

function recipe(over: Partial<any>) {
  return {
    template_key: 'x',
    name: 'Receta',
    description: null,
    trigger_type: 'lead.created',
    trigger_label: 'Se crea un lead',
    action_labels: ['Enviar email al cliente'],
    activated: false,
    available: true,
    category: 'entrada_leads',
    ...over,
  }
}

const CATALOG = [
  recipe({ template_key: 'lead_bienvenida', name: 'Bienvenida al lead' }),
  recipe({ template_key: 'lead_portal', name: 'Lead de portal', activated: true }),
  recipe({
    template_key: 'tasacion_en_curso',
    name: 'Confirmación de tasación en curso',
    category: 'tasacion',
    trigger_label: 'Un lead cambia de etapa',
  }),
  // Categoría que este build no conoce: no puede desaparecer de la galería.
  recipe({ template_key: 'receta_futura', name: 'Receta futura', category: 'todavia_no_existe' }),
]

const META = {
  triggers: [],
  actions: [],
  operators: [],
  variables: [],
  stages: { lead: [], property: [] },
  dedupe_scopes: [],
  recipe_categories: RECIPE_CATEGORIES,
}

function json(data: any) {
  return Promise.resolve({ json: () => Promise.resolve(data) })
}

beforeEach(() => {
  vi.clearAllMocks()
  apiFetch.mockImplementation((_api: string, path: string) => {
    if (path === '/automations') return json([])
    if (path === '/automations/catalog') return json(CATALOG)
    if (path === '/automations/meta') return json(META)
    return json([])
  })
})

async function abrirRecetas() {
  render(<AutomatizacionesPage />)
  const tab = await screen.findByRole('tab', { name: /Recetas/ })
  fireEvent.click(tab)
}

describe('Galería de recetas', () => {
  it('agrupa por categoría en el orden que declara el backend', async () => {
    await abrirRecetas()

    const secciones = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(secciones).toEqual(['Entrada de leads', 'Tasación', 'Otras'])
    // "Otras" recoge la categoría desconocida en vez de tragarse la receta.
    expect(screen.getByText('Receta futura')).toBeInTheDocument()
  })

  it('esconde las ya activadas para que la galería muestre sólo lo que falta', async () => {
    await abrirRecetas()

    expect(screen.getByText('Bienvenida al lead')).toBeInTheDocument()
    expect(screen.queryByText('Lead de portal')).not.toBeInTheDocument()
    // El contador de la pestaña cuenta pendientes: tiene que coincidir con lo visible.
    expect(screen.getByRole('tab', { name: /Recetas/ })).toHaveTextContent('3')

    fireEvent.click(screen.getByRole('switch', { name: /Ver las ya activadas/ }))
    expect(screen.getByText('Lead de portal')).toBeInTheDocument()
  })

  it('busca por nombre y esconde las secciones que quedan vacías', async () => {
    await abrirRecetas()

    fireEvent.change(screen.getByPlaceholderText(/Buscar receta/), { target: { value: 'tasación' } })

    expect(screen.getByText('Confirmación de tasación en curso')).toBeInTheDocument()
    expect(screen.queryByText('Bienvenida al lead')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Tasación'])
  })

  it('busca también por lo que hace la receta, no sólo por su nombre', async () => {
    await abrirRecetas()

    fireEvent.change(screen.getByPlaceholderText(/Buscar receta/), { target: { value: 'email' } })
    expect(screen.getByText('Bienvenida al lead')).toBeInTheDocument()
  })

  it('el filtro de categoría deja una sola sección y "Limpiar" lo revierte', async () => {
    await abrirRecetas()

    fireEvent.change(screen.getByRole('combobox', { name: 'Categoría' }), { target: { value: 'tasacion' } })
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Tasación'])

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
  })

  it('sin resultados ofrece salir del filtro en vez de dejar la pantalla vacía', async () => {
    await abrirRecetas()

    fireEvent.change(screen.getByPlaceholderText(/Buscar receta/), { target: { value: 'zzz' } })
    expect(screen.getByText('Ninguna receta coincide')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Bienvenida al lead')).toBeInTheDocument()
  })
})
