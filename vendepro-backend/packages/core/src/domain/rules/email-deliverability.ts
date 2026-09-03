/**
 * Dominios a los que NUNCA hay que intentar enviar un email.
 *
 * Son dominios reservados por RFC: no existen en el DNS público y no pueden
 * recibir correo por definición. Mandarles algo tiene dos costos, y el segundo
 * es el caro:
 *
 * 1. **Cuota**: cada intento consume envíos del plan.
 * 2. **Reputación**: rebotan duro (hard bounce), y una tasa alta de hard bounces
 *    hace que el proveedor degrade o suspenda la cuenta. Eso afecta a los emails
 *    que sí importan — los que van a clientes reales.
 *
 * El caso que lo motivó: el smoke de producción crea ~15 leads por corrida con
 * direcciones `smoke-a1-<run>@test.local`, y crear un lead dispara
 * automatizaciones (`api-crm/src/index.ts:167`, trigger `lead.created`). Cada
 * deploy disparaba una tanda de emails a direcciones inexistentes.
 *
 * No es un parche para el smoke: es una regla del sistema. Un typo de un agente
 * cargando `juan@gmail.local` tiene exactamente el mismo problema.
 */

/** RFC 2606 (dominios de ejemplo/prueba) + RFC 6762 (`.local`, mDNS). */
const RESERVED_TLDS = ['.test', '.example', '.invalid', '.localhost', '.local']

/** RFC 2606 §3: dominios de segundo nivel reservados para documentación. */
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org']

/**
 * `true` si la dirección apunta a un dominio reservado y por lo tanto es
 * imposible de entregar. Una dirección malformada también devuelve `true`: si no
 * se puede parsear el dominio, no hay a dónde mandarla.
 */
export function isUndeliverableEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return true

  const crudo = email.slice(at + 1)
  // El chequeo de espacios va ANTES del trim: si no, `juan@ dominio.com`
  // —malformada— quedaba como válida porque el trim borraba justo el espacio.
  if (/\s/.test(crudo)) return true

  const domain = crudo.toLowerCase()
  if (!domain) return true
  if (RESERVED_DOMAINS.includes(domain)) return true
  return RESERVED_TLDS.some(tld => domain === tld.slice(1) || domain.endsWith(tld))
}
