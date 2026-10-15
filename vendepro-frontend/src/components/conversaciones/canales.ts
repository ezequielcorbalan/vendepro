/**
 * Canales de la bandeja. Un solo lugar para el nombre que ve el usuario: el
 * backend guarda `facebook`, pero la gente dice "Messenger".
 */
export const CANALES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Messenger' },
] as const

export function nombreCanal(canal: string): string {
  return CANALES.find(c => c.value === canal)?.label ?? canal
}

/** La etiqueta con la que el bot de n8n sabe que tiene que callarse. */
export const ETIQUETA_BOT_PAUSADO = 'bot_pausado'
