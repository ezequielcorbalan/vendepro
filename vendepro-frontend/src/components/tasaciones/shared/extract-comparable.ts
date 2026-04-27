import { apiFetch } from '@/lib/api'

export interface ExtractedComparable {
  address: string | null
  zonaprop_url: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  days_on_market: number | null
  views_per_day: number | null
  age: number | null
}

/**
 * Convierte un File a base64 (sin el prefijo data:image/...).
 * Acepta cualquier imagen soportada por el navegador.
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const match = result.match(/^data:([^;]+);base64,(.*)$/)
      if (!match) return reject(new Error('No se pudo leer el archivo'))
      resolve({ mimeType: match[1], base64: match[2] })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo archivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convierte un ClipboardItem a File. Soporta paste de imagen (Ctrl+V).
 */
export function clipboardImageFromEvent(e: ClipboardEvent | React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (file) return file
    }
  }
  return null
}

/**
 * Llama al endpoint /extract-comparable de api-ai con la imagen en base64
 * y devuelve los campos detectados (cualquiera puede ser null).
 */
export async function extractComparableFromImage(file: File): Promise<ExtractedComparable> {
  const { base64, mimeType } = await fileToBase64(file)
  const res = await apiFetch('ai', '/extract-comparable', {
    method: 'POST',
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? 'No se pudo extraer la información')
  }
  const data = (await res.json()) as { fields: ExtractedComparable }
  return data.fields ?? {}
}
