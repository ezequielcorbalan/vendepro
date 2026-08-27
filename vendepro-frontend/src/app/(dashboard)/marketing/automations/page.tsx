import { redirect } from 'next/navigation'

/**
 * El módulo de secuencias de email se absorbió dentro del motor genérico de
 * automatizaciones (Configuración → Automatizaciones). Se deja el redirect
 * para no romper links ni bookmarks existentes.
 */
export default function AutomationsRedirect() {
  redirect('/configuracion/automatizaciones')
}
