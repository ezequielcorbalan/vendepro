'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Save, AlertCircle } from 'lucide-react'
import type { AppraisalBlockType, TemplateBlock } from '../renderer/types'
import { getBlockMeta } from '../renderer/block-catalog'
import { BlockForm } from '../editor/BlockForm'
import {
  STATIC_BLOCK_TYPES,
  loadStaticBlockDefaults,
  saveStaticBlockDefault,
} from '../shared/static-block-defaults'
import { _invalidateStaticDefaultsCache } from './BlockAdminForm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

interface RowState {
  /** Datos editables del bloque. */
  data: Record<string, unknown>
  /** id de la org-variable subyacente (si ya existe). */
  id?: string
  /** Hay cambios sin guardar. */
  dirty: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

type RowsMap = Partial<Record<AppraisalBlockType, RowState>>

function emptyRow(): RowState {
  return { data: {}, dirty: false, saving: false, saved: false, error: null }
}

/**
 * UI centralizada para configurar el contenido fijo de la
 * inmobiliaria que se repite en todas las tasaciones (portada,
 * propuesta, servicios, etc.).
 *
 * Estos valores NO se aplican automáticamente al renderizar —
 * se ofrecen como "defaults" que el admin puede aplicar a cada
 * template desde el editor (botón "Aplicar valores guardados"
 * en BlockAdminForm). Esa decisión consciente evita pisar
 * accidentalmente datos que ya están en un template.
 */
export function StaticBlocksHome() {
  const [rows, setRows] = useState<RowsMap | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openType, setOpenType] = useState<AppraisalBlockType | null>(null)

  useEffect(() => {
    let cancelled = false
    loadStaticBlockDefaults()
      .then(map => {
        if (cancelled) return
        const out: RowsMap = {}
        for (const type of STATIC_BLOCK_TYPES) {
          const entry = map[type]
          out[type] = entry
            ? { ...emptyRow(), data: entry.data, id: entry.id }
            : emptyRow()
        }
        setRows(out)
      })
      .catch(e => {
        if (cancelled) return
        setLoadError(e?.message ?? 'Error al cargar bloques estáticos')
        const out: RowsMap = {}
        for (const type of STATIC_BLOCK_TYPES) out[type] = emptyRow()
        setRows(out)
      })
    return () => { cancelled = true }
  }, [])

  const patchData = (type: AppraisalBlockType, patch: Record<string, unknown>) => {
    setRows(prev => {
      if (!prev) return prev
      const cur = prev[type] ?? emptyRow()
      return {
        ...prev,
        [type]: {
          ...cur,
          data: { ...cur.data, ...patch },
          dirty: true,
          saved: false,
          error: null,
        },
      }
    })
  }

  const saveOne = async (type: AppraisalBlockType) => {
    const row = rows?.[type]
    if (!row) return
    setRows(prev => prev ? { ...prev, [type]: { ...row, saving: true, saved: false, error: null } } : prev)
    try {
      const { id } = await saveStaticBlockDefault(type, row.data, row.id)
      _invalidateStaticDefaultsCache()
      setRows(prev => prev ? {
        ...prev,
        [type]: { ...prev[type]!, id, saving: false, saved: true, dirty: false, error: null },
      } : prev)
    } catch (e: any) {
      setRows(prev => prev ? {
        ...prev,
        [type]: { ...prev[type]!, saving: false, error: e?.message ?? 'Error al guardar' },
      } : prev)
    }
  }

  if (!rows) {
    return (
      <div className="space-y-3">
        {STATIC_BLOCK_TYPES.map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert tone="info" hideIcon>
        <p>
          <strong>Bloques estáticos</strong> — definí acá el contenido fijo de tu inmobiliaria
          (portada, metodología, servicios, etc.). Los valores guardados se pueden{' '}
          <strong>aplicar a cada template</strong> desde el editor, en los bloques con modo{' '}
          <em>&ldquo;Texto fijo de la inmobiliaria&rdquo;</em> o <em>&ldquo;Valor por defecto editable&rdquo;</em>.
        </p>
      </Alert>

      {loadError && (
        <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      <div className="space-y-3">
        {STATIC_BLOCK_TYPES.map(type => (
          <StaticBlockRow
            key={type}
            type={type}
            row={rows[type] ?? emptyRow()}
            isOpen={openType === type}
            onToggle={() => setOpenType(prev => (prev === type ? null : type))}
            onPatch={patch => patchData(type, patch)}
            onSave={() => saveOne(type)}
          />
        ))}
      </div>
    </div>
  )
}

interface RowProps {
  type: AppraisalBlockType
  row: RowState
  isOpen: boolean
  onToggle: () => void
  onPatch: (patch: Record<string, unknown>) => void
  onSave: () => void
}

function StaticBlockRow({ type, row, isOpen, onToggle, onPatch, onSave }: RowProps) {
  const meta = getBlockMeta(type)
  // Bloque sintético para reutilizar BlockForm en contexto 'template'
  // (sin restricciones de binding_mode).
  const fakeBlock: TemplateBlock = useMemo(() => ({
    id: `static-defaults-${type}`,
    type,
    binding_mode: 'org-static',
    include_in_pdf: true,
    sort_order: 0,
    data: row.data,
  }), [type, row.data])

  return (
    <section className="overflow-hidden rounded-card border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
      >
        {isOpen
          ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink">{meta.label}</div>
          <div className="truncate text-xs text-gray-500">{meta.description}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {row.dirty && <span className="text-warning">Sin guardar</span>}
          {row.saved && !row.dirty && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" /> Guardado
            </span>
          )}
          {!row.id && !row.dirty && !row.saved && (
            <span className="text-gray-400">Sin configurar</span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 p-4">
          <BlockForm
            block={fakeBlock}
            override={{}}
            onPatch={onPatch}
            context="template"
          />
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
            {row.error && (
              <span className="flex items-center gap-1 text-xs text-danger">
                <AlertCircle className="h-3 w-3" /> {row.error}
              </span>
            )}
            <Button
              onClick={onSave}
              disabled={!row.dirty}
              loading={row.saving}
              icon={<Save className="h-3.5 w-3.5" />}
            >
              {row.saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
