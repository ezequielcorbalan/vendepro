'use client'

import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BlockRenderer } from './BlockRenderer'
import { hydrateBlocks } from './hydrate-blocks'
import { getBlockCompleteness } from './block-completeness'
import type {
  TemplateBlock, BlockOverrides, AppraisalContext,
  ResolvedVars, RenderMode,
} from './types'

interface Props {
  snapshot: TemplateBlock[]
  overrides?: BlockOverrides
  appraisal: AppraisalContext
  resolvedVars?: ResolvedVars
  mode?: RenderMode
  className?: string
  /**
   * Modo edición (editor, review del wizard, preview del admin).
   * - editing=true: muestra TODOS los bloques; los incompletos van con un
   *   recuadro de aviso ("no se va a publicar").
   * - editing=false (default, landing pública / PDF): EXCLUYE los bloques
   *   incompletos de la salida.
   */
  editing?: boolean
}

export function TemplateRenderer({
  snapshot, overrides = {}, appraisal, resolvedVars = {}, mode = 'web', className, editing = false,
}: Props) {
  const hydrated = useMemo(
    () => hydrateBlocks({ snapshot, overrides, appraisal, resolvedVars, mode }),
    [snapshot, overrides, appraisal, resolvedVars, mode],
  )

  const brandStyle = (appraisal.org?.brand_color || appraisal.org?.brand_accent_color)
    ? ({
        '--brand-color': appraisal.org?.brand_color ?? '#ff007c',
        '--brand-accent-color': appraisal.org?.brand_accent_color ?? '#e17a2a',
      } as CSSProperties)
    : undefined

  return (
    <div
      className={className}
      style={brandStyle}
      data-force-print={mode === 'print' ? 'true' : undefined}
    >
      {hydrated.map(block => {
        const { complete, missingLabel } = getBlockCompleteness(block, appraisal)

        // Publicado: el bloque incompleto no se renderiza.
        if (!complete && !editing) return null

        const rendered = <BlockRenderer key={block.id} block={block} mode={mode} appraisal={appraisal} />

        // Edición: el bloque incompleto va con recuadro de aviso.
        if (!complete && editing) {
          return (
            <IncompleteBlockFrame key={block.id} missingLabel={missingLabel}>
              {rendered}
            </IncompleteBlockFrame>
          )
        }

        return rendered
      })}
    </div>
  )
}

function IncompleteBlockFrame({ missingLabel, children }: { missingLabel: string | null; children: ReactNode }) {
  return (
    <div className="relative border-2 border-dashed border-amber-400">
      <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Este bloque no se va a publicar
          {missingLabel ? <> — falta completar {missingLabel}.</> : ' porque faltan datos.'}
        </span>
      </div>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  )
}
