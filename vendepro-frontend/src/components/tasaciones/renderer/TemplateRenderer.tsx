'use client'

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { BlockRenderer } from './BlockRenderer'
import { hydrateBlocks } from './hydrate-blocks'
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
}

export function TemplateRenderer({
  snapshot, overrides = {}, appraisal, resolvedVars = {}, mode = 'web', className,
}: Props) {
  const hydrated = useMemo(
    () => hydrateBlocks({ snapshot, overrides, appraisal, resolvedVars, mode }),
    [snapshot, overrides, appraisal, resolvedVars, mode],
  )

  const brandStyle = appraisal.org?.brand_color
    ? ({ '--brand-color': appraisal.org.brand_color } as CSSProperties)
    : undefined

  return (
    <div
      className={className}
      style={brandStyle}
      data-force-print={mode === 'print' ? 'true' : undefined}
    >
      {hydrated.map(block => (
        <BlockRenderer key={block.id} block={block} mode={mode} appraisal={appraisal} />
      ))}
    </div>
  )
}
