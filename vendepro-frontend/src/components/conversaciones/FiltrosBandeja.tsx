'use client'

import { Search } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Select } from '@/components/ui/Input'
import { CANALES, ETIQUETA_BOT_PAUSADO } from './canales'

export type Carpeta = 'mias' | 'sin_asignar' | 'todas'

export interface ConteoCarpetas {
  mias?: number
  sinAsignar?: number
  todas?: number
}

/**
 * Carpetas y filtros de la bandeja, arriba de la lista.
 *
 * Las carpetas son las de cualquier bandeja de equipo: lo mío, la cola sin
 * asignar y todo. Un agente sólo tiene "mías" (el servidor no le muestra
 * otra cosa), así que para él no se dibujan: una pestaña sola no es un menú.
 */
interface FiltrosBandejaProps {
  reparte: boolean
  carpeta: Carpeta
  onCarpeta: (c: Carpeta) => void
  conteos: ConteoCarpetas
  busqueda: string
  onBusqueda: (q: string) => void
  canal: string
  onCanal: (c: string) => void
  etiqueta: string
  onEtiqueta: (e: string) => void
  etiquetas: string[]
}

export function FiltrosBandeja({
  reparte, carpeta, onCarpeta, conteos, busqueda, onBusqueda,
  canal, onCanal, etiqueta, onEtiqueta, etiquetas,
}: FiltrosBandejaProps) {
  return (
    <div className="border-b border-gray-100">
      {reparte && (
        <Tabs
          className="px-2"
          value={carpeta}
          onChange={v => onCarpeta(v as Carpeta)}
          items={[
            { value: 'mias', label: 'Mías', count: conteos.mias },
            { value: 'sin_asignar', label: 'Sin asignar', count: conteos.sinAsignar },
            { value: 'todas', label: 'Todas', count: conteos.todas },
          ]}
        />
      )}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Nombre, teléfono o mensaje…"
            aria-label="Buscar conversaciones"
            value={busqueda}
            onChange={e => onBusqueda(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Canal" value={canal} onChange={e => onCanal(e.target.value)}>
            <option value="">Todos los canales</option>
            {CANALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Select aria-label="Etiqueta" value={etiqueta} onChange={e => onEtiqueta(e.target.value)}>
            <option value="">Todas las etiquetas</option>
            {etiquetas.map(e => (
              <option key={e} value={e}>{e === ETIQUETA_BOT_PAUSADO ? 'Bot pausado' : e}</option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
