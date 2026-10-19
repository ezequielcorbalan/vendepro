import { describe, it, expect, vi } from 'vitest'
import { IngestMetaLeadUseCase } from '../../../src/application/use-cases/meta-leads/ingest-meta-lead'

let n = 0
const ids = { generate: () => `id_${++n}` }

function build(opts: { existente?: any; admin?: any; lead?: any } = {}) {
  const leadRepo = {
    findByMetaLeadId: vi.fn().mockResolvedValue(opts.existente ?? null),
    save: vi.fn().mockResolvedValue(undefined),
  } as any
  const contactRepo = { save: vi.fn().mockResolvedValue(undefined) } as any
  const userRepo = {
    findFirstAdminByOrg: vi.fn().mockResolvedValue(opts.admin === undefined ? { id: 'admin1' } : opts.admin),
  } as any
  const gateway = {
    fetchLead: vi.fn().mockResolvedValue(opts.lead ?? {
      id: '1234567890123456',
      created_time: '2026-10-19T10:00:00+0000',
      field_data: [
        { name: 'full_name', values: ['Ana Pérez'] },
        { name: 'email', values: ['ana@mail.com'] },
        { name: 'phone_number', values: ['+5491122334455'] },
        { name: 'barrio_de_la_propiedad', values: ['Palermo'] },
      ],
      form_id: 'f1',
      campaign_name: 'Captación Palermo',
      ad_name: 'Video depto',
      platform: 'ig',
    }),
  }
  const uc = new IngestMetaLeadUseCase(gateway, leadRepo, contactRepo, userRepo, ids)
  return { uc, leadRepo, contactRepo, gateway }
}

describe('IngestMetaLeadUseCase', () => {
  it('crea el lead con el ID de Meta, la campaña como source_detail y las preguntas propias en notas', async () => {
    const { uc, leadRepo, gateway } = build()
    const r = await uc.execute({ orgId: 'org1', leadgenId: '1234567890123456', pageAccessToken: 'tok' })

    expect(gateway.fetchLead).toHaveBeenCalledWith('1234567890123456', 'tok')
    expect(r.duplicate).toBe(false)
    const lead = leadRepo.save.mock.calls[0][0].toObject()
    expect(lead.meta_lead_id).toBe('1234567890123456')
    expect(lead.full_name).toBe('Ana Pérez')
    expect(lead.email).toBe('ana@mail.com')
    expect(lead.phone).toBe('+5491122334455')
    expect(lead.source).toBe('instagram')
    expect(lead.source_detail).toBe('Captación Palermo')
    expect(lead.assigned_to).toBe('admin1')
    expect(lead.stage).toBe('nuevo')
    expect(lead.notes).toContain('barrio de la propiedad: Palermo')
    expect(lead.notes).toContain('anuncio "Video depto"')
  })

  it('no vuelve a crear un lead que ya entró (reintento del webhook)', async () => {
    const { uc, leadRepo, gateway } = build({ existente: { id: 'lead_viejo' } })
    const r = await uc.execute({ orgId: 'org1', leadgenId: '1234567890123456', pageAccessToken: 'tok' })
    expect(r).toEqual({ duplicate: true, lead_id: 'lead_viejo' })
    expect(gateway.fetchLead).not.toHaveBeenCalled()
    expect(leadRepo.save).not.toHaveBeenCalled()
  })

  it('arma el nombre con first_name + last_name, y sin nombre usa uno genérico', async () => {
    const conPartes = build({ lead: {
      id: '1', created_time: null, form_id: null, campaign_name: null, ad_name: null, platform: 'fb',
      field_data: [{ name: 'first_name', values: ['Juan'] }, { name: 'last_name', values: ['Gómez'] }],
    } })
    await conPartes.uc.execute({ orgId: 'org1', leadgenId: '1', pageAccessToken: 'tok' })
    expect(conPartes.leadRepo.save.mock.calls[0][0].toObject().full_name).toBe('Juan Gómez')

    const sinNombre = build({ lead: {
      id: '2', created_time: null, form_id: null, campaign_name: null, ad_name: null, platform: 'fb',
      field_data: [{ name: 'phone_number', values: ['1155556666'] }],
    } })
    await sinNombre.uc.execute({ orgId: 'org1', leadgenId: '2', pageAccessToken: 'tok' })
    const lead = sinNombre.leadRepo.save.mock.calls[0][0].toObject()
    expect(lead.full_name).toBe('Lead de Facebook')
    expect(lead.source).toBe('facebook')
    expect(lead.source_detail).toBeNull()
  })

  it('reconoce nombre, teléfono y email con preguntas en castellano (como el formulario real de Marcela)', async () => {
    const { uc, leadRepo } = build({ lead: {
      id: '3', created_time: null, form_id: 'f1', campaign_name: null, ad_name: null, platform: 'fb',
      field_data: [
        { name: 'nombre', values: ['María López'] },
        { name: 'número_de_teléfono', values: ['+5491133334444'] },
        { name: 'correo_electrónico', values: ['maria@mail.com'] },
        { name: '¿en_que_te_podemos_ayudar?', values: ['Quiero tasar mi depto'] },
      ],
    } })
    await uc.execute({ orgId: 'org1', leadgenId: '3', pageAccessToken: 'tok' })
    const lead = leadRepo.save.mock.calls[0][0].toObject()
    expect(lead.full_name).toBe('María López')
    expect(lead.phone).toBe('+5491133334444')
    expect(lead.email).toBe('maria@mail.com')
    expect(lead.notes).toBe('Formulario de Meta\n¿en que te podemos ayudar?: Quiero tasar mi depto')
  })

  it('arma el nombre con "nombre" + "apellido" y reconoce el celular', async () => {
    const { uc, leadRepo } = build({ lead: {
      id: '4', created_time: null, form_id: null, campaign_name: null, ad_name: null, platform: 'ig',
      field_data: [
        { name: 'Nombre', values: ['Juan'] },
        { name: 'Apellido', values: ['Pérez'] },
        { name: 'celular', values: ['1155556666'] },
      ],
    } })
    await uc.execute({ orgId: 'org1', leadgenId: '4', pageAccessToken: 'tok' })
    const lead = leadRepo.save.mock.calls[0][0].toObject()
    expect(lead.full_name).toBe('Juan Pérez')
    expect(lead.phone).toBe('1155556666')
    expect(lead.notes).toBe('Formulario de Meta')
  })

  it('falla si la org no tiene admin a quien asignarlo', async () => {
    const { uc } = build({ admin: null })
    await expect(uc.execute({ orgId: 'org1', leadgenId: '1', pageAccessToken: 'tok' })).rejects.toThrow('administrador')
  })
})
