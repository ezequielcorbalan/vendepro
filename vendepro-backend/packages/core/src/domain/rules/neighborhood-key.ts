/**
 * Clave de agrupación para barrios cargados a mano: trim, minúsculas, sin
 * tildes y espacios colapsados. "Villa Urquiza ", "villa urquiza" y
 * "Villa Urquíza" son el mismo barrio a la hora de agrupar métricas o buscar
 * el benchmark de vendidas; si la clave es el string crudo, el match se rompe
 * en silencio y todos los avisos quedan "Sin benchmark".
 */
export function neighborhoodKey(raw: string | null | undefined): string {
  const key = (raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return key || 'sin barrio'
}
