import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useCurrentUser } from '../use-current-user'
import { setCurrentUser } from '../auth'

/**
 * El bug que esto previene no se ve en una captura: React descarta el HTML del
 * servidor y vuelve a renderizar TODO el árbol en el cliente. En
 * `/configuracion/api` el servidor mandaba "Acceso restringido" y el cliente la
 * pantalla de admin.
 *
 * La clave es `listo`: el PRIMER render tiene que ser idéntico al del servidor
 * —o sea sin usuario— y el usuario recién aparece después de montar.
 */
function Sonda() {
  const { user, listo } = useCurrentUser()
  return <p>{!listo ? 'sin saber' : user ? `rol:${user.role}` : 'sin usuario'}</p>
}

describe('useCurrentUser', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lo que renderiza el servidor no sabe el rol, aunque haya sesión guardada', () => {
    setCurrentUser({ id: '1', email: 'a@b.c', full_name: 'A', name: 'A', role: 'admin', org_id: 'o1' })
    // Se mide con `renderToStaticMarkup` y no con `render`, porque `render`
    // corre los efectos antes de devolver: mostraría el estado de después de
    // montar, que no es el que se compara en la hidratación. Esto es
    // literalmente el HTML que manda el servidor, y si dijera "rol:admin" el
    // cliente pintaría otra cosa y volvería el "Hydration failed".
    expect(renderToStaticMarkup(<Sonda />)).toContain('sin saber')
  })

  it('después de montar aparece el usuario', async () => {
    setCurrentUser({ id: '1', email: 'a@b.c', full_name: 'A', name: 'A', role: 'admin', org_id: 'o1' })
    render(<Sonda />)
    await waitFor(() => expect(screen.getByText('rol:admin')).toBeInTheDocument())
  })

  it('sin sesión queda listo igual, con el usuario en null', async () => {
    render(<Sonda />)
    await waitFor(() => expect(screen.getByText('sin usuario')).toBeInTheDocument())
  })

  it('si localStorage tira, no rompe la pantalla', async () => {
    // Ventana privada, datos del sitio bloqueados, captura de thumbnail: el
    // accessor mismo puede tirar. La pantalla tiene que quedar sin usuario, no
    // en blanco.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    render(<Sonda />)
    await waitFor(() => expect(screen.getByText('sin usuario')).toBeInTheDocument())
    spy.mockRestore()
  })
})
