'use client'
import { useReducer } from 'react'
import type { BlockOverrides, TemplateBlock, AppraisalBlockType } from '../renderer/types'

export interface EditorState {
  appraisal: any
  overrides: BlockOverrides
  /** Lista editable de bloques de ESTA tasación (se persiste en template_snapshot_json). */
  snapshot: TemplateBlock[]
  /** Revisión monotónica del snapshot; sirve para no pisar ediciones hechas durante un guardado. */
  snapshotRev: number
  dirty: boolean
  pendingPatches: {
    appraisal: Record<string, unknown>
    overrides: Record<string, Record<string, unknown>>
    /** Lista completa a guardar cuando el snapshot está sucio (o null). */
    blocks: TemplateBlock[] | null
    blocksRev: number | null
  }
}

interface SavedPatches {
  appraisal: Record<string, unknown>
  overrides: Record<string, Record<string, unknown>>
  blocksRev?: number | null
}

type Action =
  | { type: 'patch_appraisal'; patch: Record<string, unknown> }
  | { type: 'patch_override'; blockId: string; patch: Record<string, unknown> }
  | { type: 'add_block'; blockType: AppraisalBlockType; atIndex: number; data?: Record<string, unknown>; webOnly?: boolean }
  | { type: 'remove_block'; blockId: string }
  | { type: 'reorder_blocks'; from: number; to: number }
  | { type: 'patch_block_data'; blockId: string; patch: Record<string, unknown> }
  | { type: 'consume'; saved: SavedPatches }

function parseOverrides(v: unknown): BlockOverrides {
  if (!v) return {}
  if (typeof v === 'object') return v as BlockOverrides
  if (typeof v === 'string') { try { return JSON.parse(v) as BlockOverrides } catch { return {} } }
  return {}
}

function reindex(blocks: TemplateBlock[]): TemplateBlock[] {
  return blocks.map((b, i) => (b.sort_order === i ? b : { ...b, sort_order: i }))
}

function genId(): string {
  // Sin dependencias: id local único-suficiente para bloques de una tasación.
  return `b-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Reconstruye pendingPatches.blocks/blocksRev tras una mutación del snapshot. */
function withSnapshot(state: EditorState, snapshot: TemplateBlock[]): EditorState {
  const rev = state.snapshotRev + 1
  return {
    ...state,
    snapshot,
    snapshotRev: rev,
    dirty: true,
    pendingPatches: { ...state.pendingPatches, blocks: snapshot, blocksRev: rev },
  }
}

export function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'patch_appraisal':
      return {
        ...state,
        appraisal: { ...state.appraisal, ...action.patch },
        dirty: true,
        pendingPatches: {
          ...state.pendingPatches,
          appraisal: { ...state.pendingPatches.appraisal, ...action.patch },
        },
      }
    case 'patch_override': {
      const current = state.overrides[action.blockId] ?? {}
      const next = { ...current, ...action.patch }
      return {
        ...state,
        overrides: { ...state.overrides, [action.blockId]: next },
        dirty: true,
        pendingPatches: {
          ...state.pendingPatches,
          overrides: {
            ...state.pendingPatches.overrides,
            [action.blockId]: { ...(state.pendingPatches.overrides[action.blockId] ?? {}), ...action.patch },
          },
        },
      }
    }
    case 'add_block': {
      const block: TemplateBlock = {
        id: genId(),
        type: action.blockType,
        binding_mode: 'tasacion',
        include_in_pdf: !action.webOnly,
        sort_order: action.atIndex,
        data: action.data ?? {},
      }
      const next = [...state.snapshot]
      const idx = Math.max(0, Math.min(action.atIndex, next.length))
      next.splice(idx, 0, block)
      return withSnapshot(state, reindex(next))
    }
    case 'remove_block':
      return withSnapshot(state, reindex(state.snapshot.filter(b => b.id !== action.blockId)))
    case 'reorder_blocks': {
      const next = [...state.snapshot]
      const [moved] = next.splice(action.from, 1)
      if (!moved) return state
      next.splice(action.to, 0, moved)
      return withSnapshot(state, reindex(next))
    }
    case 'patch_block_data': {
      const next = state.snapshot.map(b =>
        b.id === action.blockId ? { ...b, data: { ...b.data, ...action.patch } } : b
      )
      return withSnapshot(state, next)
    }
    case 'consume': {
      // Restar solo las keys guardadas, preservando lo que se editó durante el guardado.
      const appraisalRemaining: Record<string, unknown> = { ...state.pendingPatches.appraisal }
      for (const k of Object.keys(action.saved.appraisal)) delete appraisalRemaining[k]

      const overridesRemaining: Record<string, Record<string, unknown>> = {}
      for (const [blockId, current] of Object.entries(state.pendingPatches.overrides)) {
        const savedBlock = action.saved.overrides[blockId] ?? {}
        const remaining: Record<string, unknown> = { ...current }
        for (const k of Object.keys(savedBlock)) delete remaining[k]
        if (Object.keys(remaining).length > 0) overridesRemaining[blockId] = remaining
      }

      // El snapshot se limpia solo si no hubo ediciones nuevas desde el flush.
      const blocksSettled = action.saved.blocksRev != null && action.saved.blocksRev === state.snapshotRev
      const blocksPending = blocksSettled ? null : state.pendingPatches.blocks
      const blocksRevPending = blocksSettled ? null : state.pendingPatches.blocksRev

      const stillDirty =
        Object.keys(appraisalRemaining).length > 0 ||
        Object.keys(overridesRemaining).length > 0 ||
        blocksPending != null

      return {
        ...state,
        dirty: stillDirty,
        pendingPatches: {
          appraisal: appraisalRemaining,
          overrides: overridesRemaining,
          blocks: blocksPending,
          blocksRev: blocksRevPending,
        },
      }
    }
    default:
      return state
  }
}

export function useEditorState(initial: any, snapshot: TemplateBlock[]) {
  return useReducer(editorReducer, {
    appraisal: initial,
    overrides: parseOverrides(initial.block_overrides_json),
    snapshot: [...snapshot].sort((a, b) => a.sort_order - b.sort_order),
    snapshotRev: 0,
    dirty: false,
    pendingPatches: { appraisal: {}, overrides: {}, blocks: null, blocksRev: null },
  })
}
