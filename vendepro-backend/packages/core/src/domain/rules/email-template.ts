import { escapeHtml } from './automation-interpolation'

/**
 * Template base de los emails de VendéPro.
 *
 * Todo lo que sale de la plataforma —bienvenida de una automatización, campaña
 * de marketing, prueba de configuración, recuperar contraseña— pasa por acá.
 * El autor del mensaje escribe SOLO el contenido; el encabezado con la marca,
 * el marco de la tarjeta, el footer y el link de baja los pone el sistema.
 *
 * Decisiones de compatibilidad (el HTML de email no es HTML de navegador):
 * - Layout con `<table>` y estilos inline: Outlook ignora `<div>` con flex y
 *   cualquier CSS que viva en un `<style>` del head.
 * - Ancho fijo 600px con `max-width:100%` para que no desborde en celular.
 * - `linear-gradient` con color sólido de respaldo: Outlook sólo lee el sólido.
 * - Poppins primero en la pila tipográfica, con Arial detrás: la fuente de marca
 *   se ve en los clientes que la tengan y el resto degrada sin romper el diseño.
 */

export interface EmailBrand {
  /** Nombre que se muestra en el encabezado y el footer. */
  name: string
  /** Logo de la inmobiliaria. Si falta, se muestra el nombre en texto. */
  logoUrl?: string | null
  /** Color primario de la marca (hex). */
  color?: string | null
  /** Color de acento para el degradé del borde superior. */
  accentColor?: string | null
}

/** Marca de la plataforma. Es el fallback cuando la org no tiene branding propio. */
export const VENDEPRO_BRAND: EmailBrand = {
  name: 'VendéPro',
  color: '#ff007c',
  accentColor: '#ff8017',
}

const DEFAULT_COLOR = '#ff007c'
const DEFAULT_ACCENT = '#ff8017'
const FONT_STACK = "'Poppins', 'Helvetica Neue', Arial, sans-serif"

export interface RenderEmailHtmlInput {
  brand: EmailBrand
  /** Contenido del mensaje. Puede ser un fragmento o un documento completo. */
  contentHtml: string
  /** Link de baja. Si viene, se agrega al footer. */
  unsubscribeUrl?: string | null
  /** Texto de vista previa en la bandeja (no se ve dentro del mail). */
  preheader?: string | null
}

/**
 * Envuelve el contenido en el marco de VendéPro y devuelve el documento final.
 *
 * Si `contentHtml` ya es un documento completo (una campaña vieja, un HTML
 * pegado a mano), se le extrae el cuerpo y se lo vuelve a envolver: así el
 * resultado es siempre un único documento con el mismo marco, sin `<html>`
 * anidados.
 */
export function renderEmailHtml(input: RenderEmailHtmlInput): string {
  const color = safeColor(input.brand.color, DEFAULT_COLOR)
  const accent = safeColor(input.brand.accentColor, DEFAULT_ACCENT)
  const brandName = escapeHtml(input.brand.name?.trim() || VENDEPRO_BRAND.name)
  const content = extractContentFragment(input.contentHtml)

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-font-smoothing:antialiased;">
${renderPreheader(input.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${color};background-image:linear-gradient(90deg,${color},${accent});border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;font-family:${FONT_STACK};">${renderBrandHeader(input.brand, brandName, color)}</td></tr>
<tr><td style="padding:20px 32px 32px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#333333;">
${content}
</td></tr>
<tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eeeeee;border-radius:0 0 12px 12px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#9ca3af;">
<p style="margin:0;">${brandName}</p>
${renderUnsubscribe(input.unsubscribeUrl)}
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:16px 8px 0;font-family:${FONT_STACK};font-size:11px;color:#b0b4bb;">Enviado con VendéPro</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export interface RenderEmailTextInput {
  brand: EmailBrand
  contentText: string
  unsubscribeUrl?: string | null
}

/**
 * Versión texto plano con el mismo pie que el HTML. Resend pide las dos
 * versiones: un mail sin `text` puntúa peor en los filtros de spam.
 */
export function renderEmailText(input: RenderEmailTextInput): string {
  const brandName = input.brand.name?.trim() || VENDEPRO_BRAND.name
  const parts = [input.contentText.trim(), '—', brandName]
  if (input.unsubscribeUrl) {
    parts.push(`Para dejar de recibir estos emails: ${input.unsubscribeUrl}`)
  }
  parts.push('Enviado con VendéPro')
  return parts.join('\n\n')
}

/**
 * Devuelve el cuerpo de un documento HTML, o el string tal cual si ya es un
 * fragmento. Es lo que permite re-enmarcar contenido que traía su propio
 * `<html>` sin terminar con dos documentos, uno adentro del otro.
 */
export function extractContentFragment(html: string): string {
  if (!/<html[\s>]|<!doctype\s+html/i.test(html)) return html.trim()

  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (body) return body[1].trim()

  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim()
}

// ── Piezas del marco ──────────────────────────────────────────

function renderBrandHeader(brand: EmailBrand, brandName: string, color: string): string {
  const logo = safeUrl(brand.logoUrl)
  if (logo) {
    // `max-height` no lo respeta Outlook: la altura va en el atributo.
    return `<img src="${logo}" alt="${brandName}" height="36" style="height:36px;max-width:220px;display:block;border:0;">`
  }
  return `<p style="margin:0;font-size:18px;font-weight:600;color:${color};">${brandName}</p>`
}

function renderUnsubscribe(url: string | null | undefined): string {
  const safe = safeUrl(url)
  if (!safe) return ''
  return `<p style="margin:8px 0 0;">¿No querés recibir más estos emails? ` +
    `<a href="${safe}" style="color:#9ca3af;text-decoration:underline;">Cancelar suscripción</a></p>`
}

/**
 * Texto de vista previa: se lee en la bandeja de entrada y no se ve al abrir.
 * El relleno de caracteres invisibles evita que el cliente complete la línea
 * con el principio del mensaje.
 */
function renderPreheader(preheader: string | null | undefined): string {
  const text = preheader?.trim()
  if (!text) return ''
  return `<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f4f5;">` +
    `${escapeHtml(text)}${'&#8199;&#65279;&#847; '.repeat(30)}</div>`
}

// ── Saneado ───────────────────────────────────────────────────

/**
 * El color viaja a un atributo `style`, así que sólo se acepta hex. Cualquier
 * otra cosa (una URL, un `expression(...)`) cae al color por defecto.
 */
function safeColor(value: string | null | undefined, fallback: string): string {
  const v = value?.trim() ?? ''
  return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(v) ? v : fallback
}

/** Sólo http(s): un `javascript:` en el logo o en el link de baja no entra. */
function safeUrl(value: string | null | undefined): string | null {
  const v = value?.trim() ?? ''
  if (!/^https?:\/\//i.test(v)) return null
  return escapeHtml(v)
}
