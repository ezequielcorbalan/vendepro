import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentesPage from '../page'

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'admin-1', role: 'admin' }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))

const toast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast }) }))

const ACTIVOS = [
  { id: 'admin-1', full_name: 'Gaston Corbalan', email: 'gaston@mg.com', role: 'admin' },
  { id: 'agent-2', full_name: 'Rocio Corbalan', email: 'rocio@mg.com', phone: '1122', role: 'agent' },
]
const PAPELERA = [
  { id: 'agent-9', full_name: 'Agente Viejo', email: 'viejo@mg.com', role: 'agent', deleted_at: '2026-08-10 14:00:00' },
]

function json(data: any) {
  return Promise.resolve({ json: () => Promise.resolve(data) })
}

function route(_api: string, path: string, options?: RequestInit) {
  if (path === '/agents') return json(ACTIVOS)
  if (path === '/agents/deleted') return json(PAPELERA)
  if (path === '/roles') return json([{ id: 2, name: 'agent', label: 'Agente' }])
  return json({ success: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  apiFetch.mockImplementation(route)
})

async function renderPage() {
  render(<AgentesPage />)
  await screen.findByText('Rocio Corbalan')
}

describe('Pantalla de agentes', () => {
  it('lista los agentes activos y cuenta la papelera en la tab', async () => {
    await renderPage()
    expect(screen.getByText('Gaston Corbalan')).toBeInTheDocument()
    expect(screen.getByText('2 agentes activos')).toBeInTheDocument()
    const papelera = screen.getByRole('tab', { name: /Papelera/ })
    expect(papelera).toHaveTextContent('1')
  })

  it('no ofrece eliminarse a uno mismo', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: 'Eliminar Gaston Corbalan' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Rocio Corbalan' })).toBeInTheDocument()
    // Editarse a uno mismo sí está permitido.
    expect(screen.getByRole('button', { name: 'Editar Gaston Corbalan' })).toBeInTheDocument()
  })

  it('elimina previa confirmación y refresca lista y papelera', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Rocio Corbalan' }))

    expect(await screen.findByText('Eliminar agente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('admin', '/agents?id=agent-2', { method: 'DELETE' }),
    )
    // Tras eliminar se recargan ambas listas.
    const paths = apiFetch.mock.calls.map(c => c[1])
    expect(paths.filter(p => p === '/agents')).toHaveLength(2)
    expect(paths.filter(p => p === '/agents/deleted')).toHaveLength(2)
  })

  it('cancelar la confirmación no elimina nada', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Rocio Corbalan' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByText('Eliminar agente')).not.toBeInTheDocument())
    expect(apiFetch.mock.calls.some(c => c[2]?.method === 'DELETE')).toBe(false)
  })

  it('edita email sin tocar la contraseña si el campo queda vacío', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Rocio Corbalan' }))

    const email = await screen.findByLabelText(/Email/)
    expect(email).toHaveValue('rocio@mg.com')
    fireEvent.change(email, { target: { value: 'rocio.nueva@mg.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('admin', '/agents/agent-2', expect.anything()))
    const call = apiFetch.mock.calls.find(c => c[1] === '/agents/agent-2')!
    expect(call[2].method).toBe('PUT')
    const body = JSON.parse(call[2].body)
    expect(body.email).toBe('rocio.nueva@mg.com')
    expect(body).not.toHaveProperty('password')
  })

  it('manda la contraseña nueva sólo cuando se completa', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Rocio Corbalan' }))
    fireEvent.change(await screen.findByLabelText(/Nueva contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('admin', '/agents/agent-2', expect.anything()))
    const call = apiFetch.mock.calls.find(c => c[1] === '/agents/agent-2')!
    expect(JSON.parse(call[2].body).password).toBe('secreto123')
  })

  it('muestra un error del backend al guardar', async () => {
    apiFetch.mockImplementation((api: string, path: string, options?: RequestInit) =>
      path === '/agents/agent-2' ? json({ error: 'Ya existe un usuario con ese email' }) : route(api, path, options),
    )
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Rocio Corbalan' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Ya existe un usuario con ese email', 'error'))
  })

  it('la papelera lista los eliminados y los restaura', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /Papelera/ }))

    expect(await screen.findByText('Agente Viejo')).toBeInTheDocument()
    expect(screen.getByText(/Eliminado el/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Restaurar/ }))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('admin', '/agents/agent-9/restore', { method: 'POST' }),
    )
    expect(toast).toHaveBeenCalledWith('Agente restaurado')
  })

  it('crea un agente con los datos del modal', async () => {
    apiFetch.mockImplementation((api: string, path: string, options?: RequestInit) =>
      path === '/create-agent' ? json({ id: 'nuevo-1' }) : route(api, path, options),
    )
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Nuevo agente/ }))

    fireEvent.change(await screen.findByLabelText(/Nombre completo/), { target: { value: 'Agente Nuevo' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'nuevo@mg.com' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear agente' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Agente creado'))
    const call = apiFetch.mock.calls.find(c => c[1] === '/create-agent')!
    expect(JSON.parse(call[2].body)).toMatchObject({
      full_name: 'Agente Nuevo', email: 'nuevo@mg.com', password: 'secreto123', role: 'agent',
    })
  })
})
