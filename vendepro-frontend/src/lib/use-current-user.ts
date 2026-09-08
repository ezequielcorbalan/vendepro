'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser, type CurrentUser } from './auth'

/**
 * El usuario de la sesión, leído DESPUÉS de montar.
 *
 * `getCurrentUser()` lee `localStorage`, así que en el servidor devuelve `null`
 * y en el cliente el usuario real. Llamarlo durante el render hace que el
 * servidor y el cliente pinten cosas distintas: en `/configuracion/api` el
 * servidor mandaba "Acceso restringido" y el cliente la pantalla de admin, y
 * React tiraba "Hydration failed" y volvía a renderizar todo el árbol en el
 * cliente. Pasaba en 8 pantallas, todas las que deciden qué mostrar según el rol.
 *
 * `listo` es lo que hace que sirva: hasta que sea `true` no se sabe el rol, así
 * que la pantalla tiene que mostrar su estado de carga en vez de adivinar. El
 * primer render del cliente es idéntico al del servidor y no hay mismatch.
 *
 *   const { user, listo } = useCurrentUser()
 *   if (!listo || loading) return <Skeleton />
 *   if (user?.role !== 'admin') return <EmptyState … />
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    setUser(getCurrentUser())
    setListo(true)
  }, [])

  return { user, listo }
}
