import { describe, it, expect } from 'vitest'
import {
  getLeadUrgency,
  getLeadChecklist,
  getLeadChecklistScore,
  isOverdue,
  computeLeadFunnel,
  computeConversionRate,
  type LeadForUrgency,
  type LeadForChecklist,
} from '../../src/domain/rules/lead-rules'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

describe('Lead rules', () => {
  describe('getLeadUrgency', () => {
    it('returns "lost" when stage is perdido', () => {
      const lead: LeadForUrgency = {
        stage: 'perdido',
        created_at: hoursAgo(1),
        updated_at: hoursAgo(1),
      }
      expect(getLeadUrgency(lead)).toBe('lost')
    })

    it('returns "ok" when stage is captado', () => {
      const lead: LeadForUrgency = {
        stage: 'captado',
        created_at: hoursAgo(1000),
        updated_at: hoursAgo(1000),
      }
      expect(getLeadUrgency(lead)).toBe('ok')
    })

    it('returns "ok" for a freshly created nuevo lead', () => {
      const lead: LeadForUrgency = {
        stage: 'nuevo',
        created_at: hoursAgo(1),
        updated_at: hoursAgo(1),
      }
      expect(getLeadUrgency(lead)).toBe('ok')
    })

    it('returns "danger" for a nuevo lead older than 24h', () => {
      const lead: LeadForUrgency = {
        stage: 'nuevo',
        created_at: hoursAgo(25),
        updated_at: hoursAgo(25),
      }
      expect(getLeadUrgency(lead)).toBe('danger')
    })

    it('returns "warning" when not updated in >3d (but <7d) and not nuevo', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(100),
        updated_at: hoursAgo(100), // ~4 days
      }
      expect(getLeadUrgency(lead)).toBe('warning')
    })

    it('returns "danger" when not updated in >7d', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(200),
        updated_at: hoursAgo(200), // >7 days
      }
      expect(getLeadUrgency(lead)).toBe('danger')
    })

    it('returns "ok" when updated recently', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(200),
        updated_at: hoursAgo(2),
      }
      expect(getLeadUrgency(lead)).toBe('ok')
    })

    it('falls back to created_at when updated_at is missing', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(200),
        updated_at: '',
      }
      expect(getLeadUrgency(lead)).toBe('danger')
    })
  })

  describe('getLeadChecklist', () => {
    function baseLead(): LeadForChecklist {
      return {
        phone: null,
        email: null,
        notes: null,
        operation: null,
        estimated_value: null,
        budget: null,
        neighborhood: null,
        property_address: null,
        next_step: null,
      }
    }

    it('returns all false for empty lead', () => {
      const cl = getLeadChecklist(baseLead())
      expect(cl).toEqual({
        contacto: false,
        necesidad: false,
        operacion: false,
        presupuesto: false,
        zona: false,
        proxima_accion: false,
      })
    })

    it('contacto is true when phone is present', () => {
      const cl = getLeadChecklist({ ...baseLead(), phone: '555' })
      expect(cl.contacto).toBe(true)
    })

    it('contacto is true when email is present', () => {
      const cl = getLeadChecklist({ ...baseLead(), email: 'a@b.co' })
      expect(cl.contacto).toBe(true)
    })

    it('necesidad requires notes longer than 5 chars', () => {
      expect(getLeadChecklist({ ...baseLead(), notes: 'hi' }).necesidad).toBe(false)
      expect(getLeadChecklist({ ...baseLead(), notes: 'hello world' }).necesidad).toBe(true)
    })

    it('operacion is false when empty string', () => {
      expect(getLeadChecklist({ ...baseLead(), operation: '' }).operacion).toBe(false)
      expect(getLeadChecklist({ ...baseLead(), operation: 'venta' }).operacion).toBe(true)
    })

    it('presupuesto is true when estimated_value or budget present', () => {
      expect(getLeadChecklist({ ...baseLead(), estimated_value: 100 }).presupuesto).toBe(true)
      expect(getLeadChecklist({ ...baseLead(), budget: '100k' }).presupuesto).toBe(true)
    })

    it('zona is true when neighborhood or property_address present', () => {
      expect(getLeadChecklist({ ...baseLead(), neighborhood: 'Palermo' }).zona).toBe(true)
      expect(getLeadChecklist({ ...baseLead(), property_address: 'Av. X 123' }).zona).toBe(true)
    })

    it('proxima_accion is true when next_step is set', () => {
      expect(getLeadChecklist({ ...baseLead(), next_step: 'llamar' }).proxima_accion).toBe(true)
    })
  })

  describe('getLeadChecklistScore', () => {
    function baseLead(): LeadForChecklist {
      return {
        phone: null,
        email: null,
        notes: null,
        operation: null,
        estimated_value: null,
        budget: null,
        neighborhood: null,
        property_address: null,
        next_step: null,
      }
    }

    it('returns 0 for empty lead', () => {
      expect(getLeadChecklistScore(baseLead())).toBe(0)
    })

    it('returns 100 when all items satisfied', () => {
      const full: LeadForChecklist = {
        phone: '555',
        email: 'a@b.co',
        notes: 'needs a 2 bedroom apt',
        operation: 'venta',
        estimated_value: 200000,
        budget: '200k',
        neighborhood: 'Palermo',
        property_address: 'Av. X 123',
        next_step: 'visitar',
      }
      expect(getLeadChecklistScore(full)).toBe(100)
    })

    it('returns ~50 for half-filled lead (3 of 6)', () => {
      const half: LeadForChecklist = {
        ...baseLead(),
        phone: '555',
        notes: 'necesita depto 2 amb',
        operation: 'venta',
      }
      expect(getLeadChecklistScore(half)).toBe(50)
    })
  })

  describe('isOverdue', () => {
    it('true when urgency is danger', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(200),
        updated_at: hoursAgo(200),
      }
      expect(isOverdue(lead)).toBe(true)
    })

    it('false when urgency is ok', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(1),
        updated_at: hoursAgo(1),
      }
      expect(isOverdue(lead)).toBe(false)
    })

    it('false when urgency is lost', () => {
      const lead: LeadForUrgency = {
        stage: 'perdido',
        created_at: hoursAgo(200),
        updated_at: hoursAgo(200),
      }
      expect(isOverdue(lead)).toBe(false)
    })

    it('false when urgency is warning', () => {
      const lead: LeadForUrgency = {
        stage: 'contactado',
        created_at: hoursAgo(100),
        updated_at: hoursAgo(100),
      }
      expect(isOverdue(lead)).toBe(false)
    })
  })

  describe('computeLeadFunnel', () => {
    it('returns 6 funnel stages with counts and pct', () => {
      const sb: Record<string, number> = { nuevo: 10, contactado: 5, captado: 2 }
      const funnel = computeLeadFunnel(sb, 20)
      expect(funnel).toHaveLength(6)
      const nuevo = funnel.find(f => f.stage === 'nuevo')!
      expect(nuevo.count).toBe(10)
      expect(nuevo.pct).toBe(50)
    })

    it('returns 0 pct when totalLeads is 0', () => {
      const funnel = computeLeadFunnel({}, 0)
      expect(funnel.every(f => f.pct === 0)).toBe(true)
    })

    it('fills missing stages with 0', () => {
      const funnel = computeLeadFunnel({}, 10)
      expect(funnel.every(f => f.count === 0)).toBe(true)
    })
  })

  describe('computeConversionRate', () => {
    it('returns percentage of captados over total', () => {
      expect(computeConversionRate({ captado: 2 }, 10)).toBe(20)
    })

    it('returns 0 when totalLeads is 0', () => {
      expect(computeConversionRate({ captado: 5 }, 0)).toBe(0)
    })

    it('returns 0 when no captados', () => {
      expect(computeConversionRate({}, 20)).toBe(0)
    })

    it('rounds to nearest integer', () => {
      // 1 / 3 = 33.33... → 33
      expect(computeConversionRate({ captado: 1 }, 3)).toBe(33)
    })
  })
})
