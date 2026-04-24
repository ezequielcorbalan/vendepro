'use client'
import { useReducer } from 'react'
import type { BlockOverrides } from '../renderer/types'

export interface EditorState {
  appraisal: any
  overrides: BlockOverrides
  dirty: boolean
  pendingPatches: {
    appraisal: Record<string, unknown>
    overrides: Record<string, Record<string, unknown>>
  }
}

interface SavedPatches {
  appraisal: Record<string, unknown>
  overrides: Record<string, Record<string, unknown>>
}

type Action =
  | { type: 'patch_appraisal'; patch: Record<string, unknown> }
  | { type: 'patch_override'; blockId: string; patch: Record<string, unknown> }
  | { type: 'consume'; saved: SavedPatches }

function parseOverrides(v: unknown): BlockOverrides {
  if (!v) return {}
  if (typeof v === 'object') return v as BlockOverrides
  if (typeof v === 'string') { try { return JSON.parse(v) as BlockOverrides } catch { return {} } }
  return {}
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
    case 'consume': {
      // Subtract only the keys that were saved, preserving anything added during the save.
      const appraisalRemaining: Record<string, unknown> = { ...state.pendingPatches.appraisal }
      for (const k of Object.keys(action.saved.appraisal)) delete appraisalRemaining[k]

      const overridesRemaining: Record<string, Record<string, unknown>> = {}
      for (const [blockId, current] of Object.entries(state.pendingPatches.overrides)) {
        const savedBlock = action.saved.overrides[blockId] ?? {}
        const remaining: Record<string, unknown> = { ...current }
        for (const k of Object.keys(savedBlock)) delete remaining[k]
        if (Object.keys(remaining).length > 0) overridesRemaining[blockId] = remaining
      }

      const stillDirty =
        Object.keys(appraisalRemaining).length > 0 ||
        Object.keys(overridesRemaining).length > 0

      return {
        ...state,
        dirty: stillDirty,
        pendingPatches: { appraisal: appraisalRemaining, overrides: overridesRemaining },
      }
    }
    default:
      return state
  }
}

export function useEditorState(initial: any) {
  return useReducer(editorReducer, {
    appraisal: initial,
    overrides: parseOverrides(initial.block_overrides_json),
    dirty: false,
    pendingPatches: { appraisal: {}, overrides: {} },
  })
}
