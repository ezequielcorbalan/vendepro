import { cookies } from 'next/headers'
import { getApiBase } from './api'
import { MODULES_FALLBACK, type OrgModulesState } from './modules'

/**
 * Lee el plan y los módulos de la org desde el layout del dashboard.
 *
 * Va del lado del servidor a propósito: si se resolviera en el cliente, el
 * menú y las pantallas bloqueadas parpadearían en cada navegación, mostrando
 * por un instante módulos que la inmobiliaria no tiene.
 *
 * Ante cualquier falla devuelve el fallback abierto: un error de red no puede
 * dejar sin trabajar a alguien que sí contrató el módulo.
 */
export async function getOrgModulesServer(): Promise<OrgModulesState> {
  const token = (await cookies()).get('vendepro_token')?.value
  if (!token) return MODULES_FALLBACK

  try {
    const res = await fetch(`${getApiBase('admin')}/modules`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return MODULES_FALLBACK
    const data = (await res.json()) as any
    if (!Array.isArray(data?.enabled)) return MODULES_FALLBACK
    return {
      plan: data.plan === 'pro' ? 'pro' : 'basic',
      modules: Array.isArray(data.modules) ? data.modules : [],
      enabled: data.enabled,
      catalog: Array.isArray(data.catalog) ? data.catalog : [],
    }
  } catch {
    return MODULES_FALLBACK
  }
}
