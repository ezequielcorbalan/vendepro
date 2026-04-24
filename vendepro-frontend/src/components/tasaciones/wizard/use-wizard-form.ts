'use client'
import { useReducer } from 'react'
import type { AppraisalComparable } from '../renderer/types'

export type WizardStep = 1 | 2 | 3 | 4

export interface WizardState {
  step: WizardStep
  template_id: string | null
  property: {
    address: string
    neighborhood?: string
    city?: string
    property_type?: string
    covered_area?: number | null
    total_area?: number | null
    semi_area?: number | null
    weighted_area?: number | null
  }
  lead_id: string | null
  details: {
    strengths?: string | null
    weaknesses?: string | null
    opportunities?: string | null
    threats?: string | null
    suggested_price?: number | null
    test_price?: number | null
    expected_close_price?: number | null
    usd_per_m2?: number | null
  }
  comparables: (Omit<AppraisalComparable, 'id' | 'appraisal_id' | 'sort_order'> & { sort_order?: number })[]
  publish: { generate_public_slug: boolean }
}

type Action =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; step: WizardStep }
  | { type: 'set_template'; id: string | null }
  | { type: 'patch_property'; patch: Partial<WizardState['property']> }
  | { type: 'set_lead'; id: string | null }
  | { type: 'patch_details'; patch: Partial<WizardState['details']> }
  | { type: 'add_comparable'; comparable: WizardState['comparables'][number] }
  | { type: 'remove_comparable'; index: number }
  | { type: 'toggle_public_slug' }

export const initialState: WizardState = {
  step: 1,
  template_id: null,
  lead_id: null,
  property: { address: '' },
  details: {},
  comparables: [],
  publish: { generate_public_slug: true },
}

export function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'goto':
      return { ...state, step: action.step }
    case 'next':
      return { ...state, step: Math.min(4, state.step + 1) as WizardStep }
    case 'back':
      return { ...state, step: Math.max(1, state.step - 1) as WizardStep }
    case 'set_template':
      return { ...state, template_id: action.id }
    case 'patch_property':
      return { ...state, property: { ...state.property, ...action.patch } }
    case 'set_lead':
      return { ...state, lead_id: action.id }
    case 'patch_details':
      return { ...state, details: { ...state.details, ...action.patch } }
    case 'add_comparable':
      return { ...state, comparables: [...state.comparables, action.comparable] }
    case 'remove_comparable':
      return { ...state, comparables: state.comparables.filter((_, i) => i !== action.index) }
    case 'toggle_public_slug':
      return { ...state, publish: { generate_public_slug: !state.publish.generate_public_slug } }
    default:
      return state
  }
}

export function useWizardForm(init?: Partial<WizardState>) {
  return useReducer(wizardReducer, { ...initialState, ...init })
}

export function canAdvance(state: WizardState): boolean {
  if (state.step === 2) return state.property.address.trim().length > 0
  return true
}
