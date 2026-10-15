'use client'

import { useState } from 'react'
import { Plus, Tag as TagIcon, Bot } from 'lucide-react'
import { Tag } from '@/components/ui/Tag'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown'
import { ETIQUETA_BOT_PAUSADO } from './canales'

/**
 * Etiquetas de una conversación: verlas, sacarlas, ponerle una que ya existe
 * en la org o una nueva. Son las mismas que lee el bot de n8n, así que
 * "Pausar bot" es sólo la etiqueta `bot_pausado` con un botón propio.
 */
interface EtiquetasConversacionProps {
  etiquetas: string[]
  /** Las que ya se usan en la org, para no inventar "Caliente" y "caliente". */
  sugeridas: string[]
  onCambiar: (etiquetas: string[]) => void
}

export function EtiquetasConversacion({ etiquetas, sugeridas, onCambiar }: EtiquetasConversacionProps) {
  const [nueva, setNueva] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)

  const visibles = etiquetas.filter(e => e !== ETIQUETA_BOT_PAUSADO)
  const botPausado = etiquetas.includes(ETIQUETA_BOT_PAUSADO)
  const disponibles = sugeridas.filter(s => s !== ETIQUETA_BOT_PAUSADO && !etiquetas.includes(s))

  const agregar = (etiqueta: string) => {
    const limpia = etiqueta.trim()
    if (!limpia || etiquetas.includes(limpia)) return
    onCambiar([...etiquetas, limpia])
  }

  const confirmarNueva = () => {
    agregar(nueva)
    setNueva('')
    setEscribiendo(false)
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visibles.map(e => (
        <Tag key={e} variant="soft" onRemove={() => onCambiar(etiquetas.filter(x => x !== e))}>{e}</Tag>
      ))}

      {escribiendo ? (
        <Input
          autoFocus
          aria-label="Nueva etiqueta"
          placeholder="Nueva etiqueta"
          value={nueva}
          maxLength={40}
          onChange={e => setNueva(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmarNueva() }
            if (e.key === 'Escape') { setNueva(''); setEscribiendo(false) }
          }}
          onBlur={confirmarNueva}
          className="h-7 w-36 text-xs"
        />
      ) : (
        <Dropdown
          trigger={
            <Button variant="ghost" className="h-auto px-1.5 py-0.5 text-xs gap-1" icon={<Plus className="w-3 h-3" />}>
              Etiquetar
            </Button>
          }
        >
          {disponibles.map(s => (
            <DropdownItem key={s} icon={<TagIcon className="w-3.5 h-3.5" />} onClick={() => agregar(s)}>{s}</DropdownItem>
          ))}
          {disponibles.length > 0 && <DropdownSeparator />}
          <DropdownItem icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEscribiendo(true)}>
            Nueva etiqueta…
          </DropdownItem>
        </Dropdown>
      )}

      {/* El bot de n8n deja de contestar mientras tenga esta etiqueta. */}
      <Button
        variant="ghost"
        className="h-auto px-1.5 py-0.5 text-xs gap-1"
        icon={<Bot className="w-3 h-3" />}
        onClick={() => onCambiar(botPausado
          ? etiquetas.filter(e => e !== ETIQUETA_BOT_PAUSADO)
          : [...etiquetas, ETIQUETA_BOT_PAUSADO])}
      >
        {botPausado ? 'Reactivar bot' : 'Pausar bot'}
      </Button>
    </div>
  )
}
